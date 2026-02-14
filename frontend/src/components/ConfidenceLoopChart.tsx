import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { Download, AlertCircle, RotateCcw } from 'lucide-react';

// Extend D3 type for missing definitions in d3.d.ts
const d3Extended = d3 as any;
import { cleanModelName } from '../utils/format';

interface ConfidencePoint {
  step: number;
  confidence: number | null;
  is_loop: boolean;
  page_title: string;
  intuition?: string;
}

interface ModelConfidence {
  model_id: string;
  data: ConfidencePoint[];
}

interface PairConfidence {
  pair_index: number;
  pair_name: string;
  models: ModelConfidence[];
}

interface ConfidenceLoopChartProps {
  data: PairConfidence[];
  selectedPairIndex: number;
}

const ConfidenceLoopChart: React.FC<ConfidenceLoopChartProps> = ({ data, selectedPairIndex }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hiddenModels, setHiddenModels] = useState<Set<string>>(new Set());

  const displayData = useMemo(() => {
    return data.find(d => d.pair_index === selectedPairIndex);
  }, [data, selectedPairIndex]);

  useEffect(() => {
    if (!svgRef.current || !displayData) return;

    const isDarkMode = document.documentElement.classList.contains('dark');
    const textColor = isDarkMode ? '#94a3b8' : '#475569';
    const gridColor = isDarkMode ? '#334155' : '#e2e8f0';

    d3.select(svgRef.current).selectAll('*').remove();

    const margin = { top: 40, right: 150, bottom: 50, left: 60 };
    const width = 800 - margin.left - margin.right;
    const height = 400 - margin.top - margin.bottom;

    const svg = d3.select(svgRef.current)
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Scales
    const allModels = displayData.models;
    const maxStep = d3.max(allModels, m => d3.max(m.data, d => d.step)) || 20;

    const x = d3.scaleLinear()
      .domain([0, maxStep])
      .range([0, width]);

    const y = d3.scaleLinear()
      .domain([0, 1])
      .range([height, 0]);

    const color = d3Extended.scaleOrdinal(d3Extended.schemeCategory10);
    const modelIds = allModels.map(m => m.model_id);
    color.domain(modelIds);

    // Axes
    svg.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(x).ticks(maxStep))
      .attr('color', textColor);

    svg.append('g')
      .call(d3.axisLeft(y).ticks(5).tickFormat(d3Extended.format(".0%")))
      .attr('color', textColor);

    // Labels
    svg.append('text')
      .attr('text-anchor', 'end')
      .attr('x', width)
      .attr('y', height + 40)
      .attr('fill', textColor)
      .style('font-size', '12px')
      .text('Steps');

    svg.append('text')
      .attr('text-anchor', 'end')
      .attr('transform', 'rotate(-90)')
      .attr('y', -45)
      .attr('x', 0)
      .attr('fill', textColor)
      .style('font-size', '12px')
      .text('Confidence Level');

    // Grid
    svg.append('g')
      .attr('class', 'grid')
      .attr('stroke-opacity', 0.1)
      .call(d3.axisLeft(y).tickSize(-width).tickFormat(() => ''));

    // Lines
    const line = d3Extended.line()
      .defined((d: any) => d.confidence !== null)
      .x((d: any) => x(d.step))
      .y((d: any) => y(d.confidence as number))
      .curve(d3Extended.curveMonotoneX);

    allModels.forEach((model) => {
      const isVisible = !hiddenModels.has(model.model_id);
      const modelColor = color(model.model_id);
      
      svg.append('path')
        .datum(model.data as any)
        .attr('fill', 'none')
        .attr('stroke', modelColor)
        .attr('stroke-width', 2)
        .attr('opacity', isVisible ? 1 : 0)
        .attr('d', line);

      // Add markers for loops
      if (isVisible) {
        const loops = model.data.filter(d => d.is_loop);
        
        const loopGroups = svg.selectAll(`.loop-${model.model_id.replace(/[^a-zA-Z0-9]/g, '')}`)
          .data(loops)
          .enter()
          .append('g')
          .attr('transform', (d: any) => `translate(${x(d.step)}, ${y(d.confidence || 0)})`);

        loopGroups.append('circle')
          .attr('r', 8)
          .attr('fill', 'none')
          .attr('stroke', '#ef4444')
          .attr('stroke-width', 2)
          .attr('stroke-dasharray', '2,2');
        
        loopGroups.append('path')
          .attr('d', d3Extended.symbol(d3Extended.symbolCross, 40)())
          .attr('fill', '#ef4444');
      }
    });

    // Legend
    modelIds.forEach((modelId, i) => {
      const isVisible = !hiddenModels.has(modelId);
      const modelColor = color(modelId);
      const legendRow = svg.append('g')
        .attr('transform', `translate(${width + 10}, ${i * 20})`)
        .attr('class', 'cursor-pointer')
        .on('click', () => {
          setHiddenModels(prev => {
            const next = new Set(prev);
            if (next.has(modelId)) next.delete(modelId);
            else next.add(modelId);
            return next;
          });
        });
      
      legendRow.append('rect')
        .attr('width', 10)
        .attr('height', 10)
        .attr('fill', modelColor)
        .attr('opacity', isVisible ? 1 : 0.2);

      legendRow.append('text')
        .attr('x', 15)
        .attr('y', 10)
        .attr('fill', textColor)
        .style('font-size', '10px')
        .style('opacity', isVisible ? 1 : 0.5)
        .style('text-decoration', isVisible ? 'none' : 'line-through')
        .text(cleanModelName(modelId.split('/').pop() || modelId));
    });

    // Loop Legend
    const loopLegendY = modelIds.length * 20 + 20;
    const loopLegend = svg.append('g')
      .attr('transform', `translate(${width + 10}, ${loopLegendY})`);
    
    loopLegend.append('circle')
      .attr('cx', 5)
      .attr('cy', 5)
      .attr('r', 5)
      .attr('fill', 'none')
      .attr('stroke', '#ef4444')
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '1,1');
    
    loopLegend.append('path')
      .attr('transform', 'translate(5, 5)')
      .attr('d', d3Extended.symbol(d3Extended.symbolCross, 20)())
      .attr('fill', '#ef4444');

    loopLegend.append('text')
      .attr('x', 15)
      .attr('y', 9)
      .attr('fill', '#ef4444')
      .style('font-size', '10px')
      .style('font-weight', 'bold')
      .text('Loop Detected');

    // Tooltip
    const tooltip = d3.select('body').append('div')
      .attr('class', 'absolute hidden bg-slate-900 text-white p-3 rounded-lg text-xs shadow-2xl z-50 pointer-events-none border border-slate-700 max-w-xs');

    const dots = svg.selectAll('.dot-group')
      .data(allModels.filter(m => !hiddenModels.has(m.model_id)) as any[])
      .enter()
      .append('g')
      .attr('fill', (d: any) => color(d.model_id));

    dots.selectAll('circle')
      .data(((d: any) => d.data.map((p: any) => ({ ...p, modelId: d.model_id }))) as any)
      .enter()
      .append('circle')
      .attr('cx', (d: any) => x(d.step))
      .attr('cy', (d: any) => y(d.confidence || 0))
      .attr('r', 4)
      .attr('class', 'cursor-pointer')
      .on('mouseover', (event: any, d: any) => {
        tooltip.style('display', 'block')
          .html(`
            <div class="font-bold text-blue-400 mb-1">${cleanModelName(d.modelId.split('/').pop() || d.modelId)}</div>
            <div class="font-semibold mb-1">${d.page_title}</div>
            <div class="flex items-center gap-2 mb-2">
              <span class="text-slate-400">Confidence:</span>
              <span class="font-bold ${d.confidence && d.confidence > 0.7 ? 'text-green-400' : d.confidence && d.confidence > 0.4 ? 'text-yellow-400' : 'text-red-400'}">
                ${d.confidence ? (d.confidence * 100).toFixed(0) + '%' : 'N/A'}
              </span>
            </div>
            ${d.is_loop ? `
              <div class="flex items-center gap-1 text-red-400 font-bold mb-2 bg-red-400/10 p-1 rounded">
                <RotateCcw size={12} /> Loop Detected
              </div>
            ` : ''}
            ${d.intuition ? `
              <div class="text-slate-300 italic border-t border-slate-700 pt-2 mt-1">
                "${d.intuition}"
              </div>
            ` : ''}
          `);
      })
      .on('mousemove', (event: any) => {
        tooltip.style('left', (event.pageX + 15) + 'px')
          .style('top', (event.pageY - 15) + 'px');
      })
      .on('mouseout', () => {
        tooltip.style('display', 'none');
      });

    return () => {
      tooltip.remove();
    };
  }, [displayData, hiddenModels]);

  const downloadChart = () => {
    if (!svgRef.current) return;
    const svg = svgRef.current;
    const width = svg.clientWidth || 800;
    const height = svg.clientHeight || 400;
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
        downloadLink.download = 'confidence_loop_analysis.png';
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
          <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
            Confidence & Loop Analysis
            <AlertCircle className="w-4 h-4 text-slate-400" />
          </h3>
          <p className="text-xs text-slate-500 mt-1">Correlation between model confidence and path looping behavior</p>
        </div>
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

export default ConfidenceLoopChart;
