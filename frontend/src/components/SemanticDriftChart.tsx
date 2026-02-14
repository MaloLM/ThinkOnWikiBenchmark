import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { Download } from 'lucide-react';
import { cleanModelName } from '../utils/format';

interface DriftPoint {
  step: number;
  distance: number | null;
}

interface ModelDrift {
  model_id: string;
  drift: DriftPoint[];
}

interface PairDrift {
  pair_index: number;
  pair_name: string;
  models: ModelDrift[];
}

interface SemanticDriftChartProps {
  data: PairDrift[];
  selectedPairIndex: number;
  showAllPairs?: boolean;
}

const SemanticDriftChart: React.FC<SemanticDriftChartProps> = ({ data, selectedPairIndex, showAllPairs = false }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hiddenModels, setHiddenModels] = useState<Set<string>>(new Set());

  const displayData = useMemo(() => {
    return showAllPairs ? data : data.filter(d => d.pair_index === selectedPairIndex);
  }, [data, selectedPairIndex, showAllPairs]);

  useEffect(() => {
    if (!svgRef.current || !displayData || displayData.length === 0) return;

    const isDarkMode = document.documentElement.classList.contains('dark');
    const textColor = isDarkMode ? '#94a3b8' : '#475569';
    const gridColor = isDarkMode ? '#334155' : '#e2e8f0';

    const svgElement = d3.select(svgRef.current);
    svgElement.selectAll('*').remove();

    const margin = { top: 40, right: 150, bottom: 50, left: 60 };
    const width = 800 - margin.left - margin.right;
    const height = 400 - margin.top - margin.bottom;

    const svg = svgElement
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Scales
    const allModels = displayData.flatMap(p => p.models);
    
    const maxStep = d3.max(allModels, m => d3.max(m.drift, d => d.step)) || 20;
    const maxDistance = d3.max(allModels, m => d3.max(m.drift, d => d.distance || 0)) || 10;

    const x = d3.scaleLinear()
      .domain([0, maxStep])
      .range([0, width]);

    const y = d3.scaleLinear()
      .domain([0, maxDistance * 1.1])
      .nice()
      .range([height, 0]);

    const color = d3.scaleOrdinal<string, string>(d3.schemeCategory10 as string[]);
    const modelIds = Array.from(new Set(allModels.map(m => m.model_id)));
    color.domain(modelIds);

    // Axes
    svg.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(x).ticks(maxStep))
      .attr('color', textColor);

    svg.append('g')
      .call(d3.axisLeft(y).ticks(maxDistance))
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
      .attr('y', -40)
      .attr('x', 0)
      .attr('fill', textColor)
      .style('font-size', '12px')
      .text('Distance to Target (clics)');

    // Grid
    svg.append('g')
      .attr('class', 'grid')
      .attr('stroke-opacity', 0.1)
      .call(d3.axisLeft(y).tickSize(-width).tickFormat(() => ''));

    // Lines
    const lineGenerator = d3.line<DriftPoint>()
      .defined((d: DriftPoint) => d.distance !== null)
      .x((d: DriftPoint) => x(d.step))
      .y((d: DriftPoint) => y(d.distance as number))
      .curve(d3.curveMonotoneX);

    displayData.forEach((pair, pairIdx) => {
      pair.models.forEach((model) => {
        const isVisible = !hiddenModels.has(model.model_id);
        const modelColor = color(model.model_id);
        
        svg.append('path')
          .datum(model.drift)
          .attr('fill', 'none')
          .attr('stroke', modelColor)
          .attr('stroke-width', showAllPairs ? 1.5 : 2.5)
          .attr('stroke-dasharray', showAllPairs ? (pairIdx * 2 + 2) + "," + (pairIdx * 1) : "0")
          .attr('opacity', isVisible ? (showAllPairs ? 0.6 : 1) : 0)
          .attr('d', lineGenerator);
      });
    });

    // Legend (Models)
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

    // Legend (Pairs - only if showAllPairs)
    if (showAllPairs) {
      const pairLegendStart = modelIds.length * 20 + 20;
      displayData.forEach((pair, i) => {
        const legendRow = svg.append('g')
          .attr('transform', `translate(${width + 10}, ${pairLegendStart + i * 20})`);
        
        legendRow.append('line')
          .attr('x1', 0)
          .attr('y1', 5)
          .attr('x2', 15)
          .attr('y2', 5)
          .attr('stroke', textColor)
          .attr('stroke-width', 1.5)
          .attr('stroke-dasharray', (i * 2 + 2) + "," + (i * 1));

        legendRow.append('text')
          .attr('x', 20)
          .attr('y', 10)
          .attr('fill', textColor)
          .style('font-size', '9px')
          .text(`Pair #${pair.pair_index + 1}`);
      });
    }

    // Tooltip
    const tooltip = d3.select('body').append('div')
      .attr('class', 'absolute hidden bg-slate-900 text-white p-2 rounded text-xs shadow-xl z-50 pointer-events-none border border-slate-700');

    const visibleModelsData = allModels.filter(m => !hiddenModels.has(m.model_id));
    
    const dotGroups = svg.selectAll('.dot-group')
      .data(visibleModelsData)
      .enter()
      .append('g')
      .attr('class', 'dot-group')
      .attr('fill', (d: ModelDrift) => color(d.model_id));

    dotGroups.each(function(modelData: ModelDrift) {
      const group = d3.select(this);
      const pair = displayData.find(p => p.models.includes(modelData));
      
      const points = modelData.drift.map((p, i) => {
        let displayDistance = p.distance;
        if (p.distance === null) {
          const prev = modelData.drift.slice(0, i).reverse().find(d => d.distance !== null);
          const next = modelData.drift.slice(i + 1).find(d => d.distance !== null);
          
          if (prev && next) displayDistance = (prev.distance! + next.distance!) / 2;
          else if (prev) displayDistance = prev.distance;
          else if (next) displayDistance = next.distance;
          else displayDistance = maxDistance / 2;
        }
        return { 
          ...p, 
          interpolatedDistance: displayDistance,
          modelId: modelData.model_id, 
          pairName: pair?.pair_name 
        };
      });

      const markers = group.selectAll('.point-marker')
        .data(points)
        .enter()
        .append('g')
        .attr('class', 'point-marker cursor-pointer');

      markers.each(function(d: any) {
        const markerGroup = d3.select(this);
        if (d.distance !== null) {
          markerGroup.append('circle')
            .attr('cx', x(d.step))
            .attr('cy', y(d.distance))
            .attr('r', showAllPairs ? 2 : 4)
            .attr('opacity', showAllPairs ? 0.4 : 1);
        } else {
          const size = showAllPairs ? 2 : 4;
          const cx = x(d.step);
          const cy = y(d.interpolatedDistance as number);
          
          markerGroup.append('line')
            .attr('x1', cx - size)
            .attr('y1', cy - size)
            .attr('x2', cx + size)
            .attr('y2', cy + size)
            .attr('stroke', color(d.modelId))
            .attr('stroke-width', 2)
            .attr('opacity', showAllPairs ? 0.6 : 1);
            
          markerGroup.append('line')
            .attr('x1', cx + size)
            .attr('y1', cy - size)
            .attr('x2', cx - size)
            .attr('y2', cy + size)
            .attr('stroke', color(d.modelId))
            .attr('stroke-width', 2)
            .attr('opacity', showAllPairs ? 0.6 : 1);
        }
      });

      markers
        .on('mouseover', (event: any, d: any) => {
          tooltip.style('display', 'block')
            .html(`
              <div class="font-bold">${cleanModelName(d.modelId.split('/').pop() || d.modelId)}</div>
              ${showAllPairs ? `<div class="text-slate-400 text-[10px]">${d.pairName}</div>` : ''}
              <div>Step: ${d.step}</div>
              <div>Distance: <span class="font-bold ${d.distance === null ? 'text-red-400' : 'text-blue-400'}">${d.distance === null ? 'No path' : d.distance}</span></div>
            `);
        })
        .on('mousemove', (event: any) => {
          tooltip.style('left', (event.pageX + 10) + 'px')
            .style('top', (event.pageY - 10) + 'px');
        })
        .on('mouseout', () => {
          tooltip.style('display', 'none');
        });
    });

    return () => {
      tooltip.remove();
    };
  }, [displayData, hiddenModels, showAllPairs]);

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
        downloadLink.download = 'semantic_drift.png';
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
          <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">Semantic Drift Analysis</h3>
          <p className="text-xs text-slate-500 mt-1">Evolution of the shortest path distance to target at each step</p>
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

export default SemanticDriftChart;
