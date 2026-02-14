import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { Download } from 'lucide-react';
import { cleanModelName } from '../utils/format';

interface SimilarityData {
  pair_index: number;
  pair_name: string;
  models: string[];
  matrix: number[][];
}

interface PathSimilarityMatrixProps {
  data: SimilarityData[];
  selectedPairIndex: number;
}

const PathSimilarityMatrix: React.FC<PathSimilarityMatrixProps> = ({ data, selectedPairIndex }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const pairData = data.find(d => d.pair_index === selectedPairIndex) || data[0];

  useEffect(() => {
    if (!svgRef.current || !pairData) return;

    const isDarkMode = document.documentElement.classList.contains('dark');
    const textColor = isDarkMode ? '#94a3b8' : '#475569';
    const gridColor = isDarkMode ? '#334155' : '#e2e8f0';

    // Clear previous chart
    d3.select(svgRef.current).selectAll('*').remove();

    const margin = { top: 100, right: 50, bottom: 50, left: 150 };
    const width = 600 - margin.left - margin.right;
    const height = 600 - margin.top - margin.bottom;

    const svg = d3.select(svgRef.current)
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const models = pairData.models;
    const matrix = pairData.matrix;

    // Build data for heatmap
    const heatmapData: { x: string, y: string, value: number }[] = [];
    models.forEach((m1, i) => {
      models.forEach((m2, j) => {
        heatmapData.push({ x: m1, y: m2, value: matrix[i][j] });
      });
    });

    // Scales
    const x = d3.scaleBand()
      .range([0, width])
      .domain(models)
      .padding(0.05);

    const y = d3.scaleBand()
      .range([0, height])
      .domain(models)
      .padding(0.05);

    // Color scale
    const colorScale = d3.scaleSequential<string>()
      .interpolator(d3.interpolateBlues)
      .domain([0, 1]);

    // Axes
    svg.append('g')
      .style('font-size', '10px')
      .attr('transform', `translate(0,-10)`)
      .call(d3.axisTop(x).tickFormat((d: any) => cleanModelName(d.split('/').pop() || d)))
      .selectAll('text')
      .style('text-anchor', 'start')
      .attr('dx', '1em')
      .attr('dy', '0.5em')
      .attr('transform', 'rotate(-45)')
      .attr('fill', textColor);

    svg.append('g')
      .style('font-size', '10px')
      .call(d3.axisLeft(y).tickFormat((d: any) => cleanModelName(d.split('/').pop() || d)))
      .selectAll('text')
      .attr('fill', textColor);

    // Tooltip
    const tooltip = d3.select('body').append('div')
      .attr('class', 'absolute hidden bg-slate-900 text-white p-2 rounded text-xs shadow-xl z-50 pointer-events-none border border-slate-700');

    // Rectangles
    svg.selectAll('.cell')
      .data(heatmapData)
      .enter()
      .append('rect')
      .attr('class', 'cell')
      .attr('x', (d: any) => x(d.x) || 0)
      .attr('y', (d: any) => y(d.y) || 0)
      .attr('rx', 4)
      .attr('ry', 4)
      .attr('width', x.bandwidth())
      .attr('height', y.bandwidth())
      .style('fill', (d: any) => colorScale(d.value))
      .style('stroke-width', 1)
      .style('stroke', gridColor)
      .on('mouseover', (event: any, d: any) => {
        tooltip.style('display', 'block')
          .html(`
            <div class="font-bold mb-1">Path Similarity (Jaccard)</div>
            <div class="text-slate-300">${cleanModelName(d.x.split('/').pop() || d.x)}</div>
            <div class="text-slate-300">vs</div>
            <div class="text-slate-300">${cleanModelName(d.y.split('/').pop() || d.y)}</div>
            <div class="mt-1 font-bold text-blue-400">${(d.value * 100).toFixed(1)}%</div>
          `);
      })
      .on('mousemove', (event: any) => {
        tooltip.style('left', (event.pageX + 10) + 'px')
          .style('top', (event.pageY - 10) + 'px');
      })
      .on('mouseout', () => {
        tooltip.style('display', 'none');
      });

    // Add values inside cells
    svg.selectAll('.cell-text')
      .data(heatmapData)
      .enter()
      .append('text')
      .attr('class', 'cell-text')
      .attr('x', (d: any) => (x(d.x) || 0) + x.bandwidth() / 2)
      .attr('y', (d: any) => (y(d.y) || 0) + y.bandwidth() / 2)
      .attr('dy', '.35em')
      .attr('text-anchor', 'middle')
      .style('font-size', '10px')
      .style('fill', (d: any) => d.value > 0.5 ? 'white' : textColor)
      .style('pointer-events', 'none')
      .text((d: any) => d.value.toFixed(2));

    return () => {
      tooltip.remove();
    };
  }, [pairData]);

  const downloadChart = () => {
    if (!svgRef.current) return;
    const svg = svgRef.current;
    const width = svg.clientWidth || 600;
    const height = svg.clientHeight || 600;
    const svgData = new XMLSerializer().serializeToString(svg);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = width * 2;
      canvas.height = height * 2;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.scale(2, 2);
        ctx.drawImage(img, 0, 0);
        const pngUrl = canvas.toDataURL('image/png');
        const downloadLink = document.createElement('a');
        downloadLink.href = pngUrl;
        downloadLink.download = 'path_similarity_matrix.png';
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
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">Path Similarity Matrix</h3>
          <p className="text-xs text-slate-500 mt-1">Jaccard index of visited pages between models</p>
        </div>
        <button 
          onClick={downloadChart}
          className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-slate-500"
          title="Download as PNG"
        >
          <Download className="w-4 h-4" />
        </button>
      </div>
      <div className="min-w-[600px] flex justify-center">
        <svg ref={svgRef}></svg>
      </div>
    </div>
  );
};

export default PathSimilarityMatrix;
