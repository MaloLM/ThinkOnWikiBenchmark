import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { Download } from 'lucide-react';

interface AnalysisResult {
  pair_index: number;
  pair_name: string;
  steps: number;
  status: string;
  shortest_path: number;
}

interface ModelComparisonData {
  model_id: string;
  results: AnalysisResult[];
}

interface AnalysisChartProps {
  data: ModelComparisonData[];
}

const AnalysisChart: React.FC<AnalysisChartProps> = ({ data }) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || !data || data.length === 0) return;

    // Clear previous chart
    d3.select(svgRef.current).selectAll('*').remove();

    const margin = { top: 40, right: 30, bottom: 70, left: 60 };
    const width = 800 - margin.left - margin.right;
    const height = 400 - margin.top - margin.bottom;

    const svg = d3.select(svgRef.current)
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // X0 scale (models)
    const x0 = d3.scaleBand<string>()
      .domain(data.map(d => d.model_id))
      .rangeRound([0, width])
      .paddingInner(0.1);

    // X1 scale (pairs within models)
    const pairIndices = data[0].results.map(r => r.pair_index.toString());
    const x1 = d3.scaleBand<string>()
      .domain(pairIndices)
      .rangeRound([0, x0.bandwidth()])
      .padding(0.05);

    // Y scale
    const maxY = d3.max(data, d => d3.max(d.results, r => Math.max(r.steps, r.shortest_path))) || 10;
    const y = d3.scaleLinear()
      .domain([0, maxY * 1.1])
      .nice()
      .range([height, 0]);

    // Axes
    svg.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(x0))
      .selectAll('text')
      .style('text-anchor', 'end')
      .attr('dx', '-.8em')
      .attr('dy', '.15em')
      .attr('transform', 'rotate(-25)')
      .attr('class', 'text-xs font-medium fill-slate-600 dark:fill-slate-400');

    svg.append('g')
      .call(d3.axisLeft(y).ticks(5))
      .attr('class', 'text-xs fill-slate-600 dark:fill-slate-400');

    // Grid lines
    svg.append('g')
      .attr('class', 'grid opacity-10')
      .call(d3.axisLeft(y).tickSize(-width).tickFormat(() => ''));

    // Tooltip
    const tooltip = d3.select('body').append('div')
      .attr('class', 'absolute hidden bg-slate-900 text-white p-2 rounded text-xs shadow-xl z-50 pointer-events-none');

    // Groups for each model
    const modelGroup = svg.selectAll('.model-group')
      .data(data)
      .enter().append('g')
      .attr('class', 'model-group')
      .attr('transform', d => `translate(${x0(d.model_id) || 0},0)`);

    // Actual steps bars
    modelGroup.selectAll('.steps-bar')
      .data(d => d.results)
      .enter().append('rect')
      .attr('class', 'steps-bar')
      .attr('x', (r: AnalysisResult) => x1(r.pair_index.toString()) || 0)
      .attr('y', (r: AnalysisResult) => y(r.steps))
      .attr('width', x1.bandwidth())
      .attr('height', (r: AnalysisResult) => height - y(r.steps))
      .attr('fill', (r: AnalysisResult) => {
        if (r.status === 'shortest') return '#fbbf24'; // Gold color
        return r.status === 'success' ? '#22c55e' : '#ef4444';
      })
      .on('mouseover', (event: any, r: AnalysisResult) => {
        const target = event.currentTarget as SVGElement;
        const parent = target.parentNode as any;
        const modelData = d3.select(parent).datum() as ModelComparisonData;
        const isShortest = r.status === 'shortest';
        tooltip.style('display', 'block')
          .html(`
            <div class="font-bold mb-1">${isShortest ? 'Shortest Path Reference' : modelData.model_id.split('/').pop()}</div>
            <div class="text-slate-300">${r.pair_name}</div>
            <div class="mt-1">Steps: <span class="font-bold">${r.steps}</span></div>
            ${!isShortest ? `<div>Shortest: <span class="font-bold">${r.shortest_path}</span></div>` : ''}
            <div>Status: <span class="font-bold ${r.status === 'success' ? 'text-green-400' : r.status === 'failed' ? 'text-red-400' : 'text-slate-400'}">${r.status}</span></div>
          `);
      })
      .on('mousemove', (event: any) => {
        tooltip.style('left', (event.pageX + 10) + 'px')
          .style('top', (event.pageY - 10) + 'px');
      })
      .on('mouseout', () => {
        tooltip.style('display', 'none');
      });

    // Legend
    const legend = svg.append('g')
      .attr('transform', `translate(${width - 150}, ${-30})`);

    const legendItems = [
      { label: 'Success', color: '#22c55e' },
      { label: 'Failed', color: '#ef4444' },
      { label: 'Shortest Path (Ref)', color: '#fbbf24' }
    ];

    legendItems.forEach((item: any, i) => {
      const g = legend.append('g').attr('transform', `translate(0, ${i * 15})`);
      g.append('rect').attr('width', 10).attr('height', 10).attr('fill', item.color).attr('opacity', item.opacity || 1);
      g.append('text').attr('x', 15).attr('y', 9).text(item.label).attr('class', 'text-[10px] fill-slate-500');
    });

    return () => {
      tooltip.remove();
    };
  }, [data]);

  const downloadChart = () => {
    if (!svgRef.current) return;

    const svg = svgRef.current;
    const width = svg.clientWidth || 800;
    const height = svg.clientHeight || 400;
    
    // Create a blob from SVG XML
    const svgData = new XMLSerializer().serializeToString(svg);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    // Load SVG into an Image
    const img = new Image();
    img.onload = () => {
      // Draw Image onto Canvas
      const canvas = document.createElement('canvas');
      canvas.width = width * 2; // Higher resolution
      canvas.height = height * 2;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = 'white'; // Background color
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.scale(2, 2);
        ctx.drawImage(img, 0, 0);
        
        // Trigger download
        const pngUrl = canvas.toDataURL('image/png');
        const downloadLink = document.createElement('a');
        downloadLink.href = pngUrl;
        downloadLink.download = 'benchmark_analysis.png';
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
      }
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  return (
    <div className="w-full bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-inner overflow-x-auto">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">Model Performance Comparison</h3>
        <button 
          onClick={downloadChart}
          className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-slate-500"
          title="Download as PNG"
        >
          <Download className="w-4 h-4" />
        </button>
      </div>
      <div className="min-w-[800px] flex justify-center">
        <svg ref={svgRef}></svg>
      </div>
    </div>
  );
};

export default AnalysisChart;
