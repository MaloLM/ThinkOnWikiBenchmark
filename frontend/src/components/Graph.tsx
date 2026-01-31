import {
  useEffect,
  useRef,
  useState,
  useImperativeHandle,
  forwardRef,
  memo,
} from "react";
import * as d3 from "d3";
import type { WikiNode, WikiLink } from "../types";
import { useTheme } from "../hooks/useTheme";

interface GraphProps {
  nodes: WikiNode[];
  links: WikiLink[];
}

export interface GraphHandle {
  resetView: () => void;
}

const Graph = forwardRef<GraphHandle, GraphProps>(({ nodes, links }, ref) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef<any>(null);
  const initialTransformRef = useRef<any>(null);
  const { theme } = useTheme();
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  // Expose resetView function to parent component
  useImperativeHandle(
    ref,
    () => ({
      resetView: () => {
        if (svgRef.current && zoomRef.current && initialTransformRef.current) {
          const svg = d3.select(svgRef.current) as any;
          svg
            .transition()
            .duration(500)
            .call(zoomRef.current.transform, initialTransformRef.current);
        }
      },
    }),
    [],
  );

  // Theme-aware colors
  const isDark = theme === "dark";
  const colors = {
    defaultNode: isDark ? "#475569" : "#e2e8f0", // slate-600 / slate-200 - neutral color
    nodeStroke: isDark ? "#64748b" : "#94a3b8", // slate-500 / slate-400
    linkDefault: isDark ? "#64748b" : "#94a3b8", // slate-500 / slate-400
    linkLoop: "#ef4444", // red-500
    textClass: isDark
      ? "text-[10px] font-medium fill-slate-300 pointer-events-none"
      : "text-[10px] font-medium fill-slate-700 pointer-events-none",
  };

  // Calculate scale factor based on container size for optimal proportions
  const baseSize = 800; // Reference size for scaling
  const scaleFactor = Math.min(dimensions.width, dimensions.height) / baseSize;
  const nodeRadius = Math.max(16, 20 * scaleFactor);
  const linkDistance = Math.max(80, 100 * scaleFactor);
  const chargeStrength = Math.min(-200, -300 * scaleFactor);
  const collisionRadius = Math.max(40, 50 * scaleFactor);

  // ResizeObserver to track container dimensions
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setDimensions({ width, height });
        }
      }
    });

    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!svgRef.current) return;

    const { width, height } = dimensions;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    if (nodes.length === 0) return;

    // Create a copy of nodes/links for simulation (to avoid mutating props)
    const simNodes = nodes.map((n) => ({ ...n }));
    const simLinks = links.map((l) => ({ ...l }));

    // Pre-run the simulation to calculate final positions BEFORE rendering
    const simulation = d3
      .forceSimulation<WikiNode>(simNodes)
      .force(
        "link",
        d3
          .forceLink<WikiNode, WikiLink>(simLinks)
          .id((d: WikiNode) => d.id)
          .distance(linkDistance),
      )
      .force("charge", d3.forceManyBody().strength(chargeStrength))
      .force("center", d3.forceCenter(0, 0))
      .force("collision", d3.forceCollide().radius(collisionRadius))
      // Add a force to push nodes along the X axis based on their step index
      // This helps reduce edge crossing for path-like data
      .force(
        "x",
        d3
          .forceX((d: any) => {
            if (d.steps && d.steps.length > 0) {
              return d.steps[0] * linkDistance * 1.5;
            }
            return 0;
          })
          .strength(0.5),
      )
      .stop(); // Stop auto-running

    // Run simulation synchronously to completion
    const numIterations = 300;
    for (let i = 0; i < numIterations; i++) {
      simulation.tick();
    }

    // Now calculate the transform to fit 80% of viewport
    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity;
    simNodes.forEach((node: any) => {
      if (node.x !== undefined && node.y !== undefined) {
        minX = Math.min(minX, node.x);
        maxX = Math.max(maxX, node.x);
        minY = Math.min(minY, node.y);
        maxY = Math.max(maxY, node.y);
      }
    });

    // Add padding for node radius and labels
    const padding = nodeRadius * 3;
    minX -= padding;
    maxX += padding;
    minY -= padding;
    maxY += padding + 20;

    const graphWidth = maxX - minX;
    const graphHeight = maxY - minY;

    // Calculate scale to fit with 80% of available space
    const targetRatio = 0.8;
    let scale = 1;
    if (graphWidth > 0 && graphHeight > 0) {
      const scaleX = (width * targetRatio) / graphWidth;
      const scaleY = (height * targetRatio) / graphHeight;
      scale = Math.max(0.1, Math.min(scaleX, scaleY, 5));
    }

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    // Define arrow markers
    const defs = svg.append("defs");

    defs
      .append("marker")
      .attr("id", "arrow-default")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 10)
      .attr("refY", 0)
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,-5L10,0L0,5")
      .attr("fill", colors.linkDefault);

    defs
      .append("marker")
      .attr("id", "arrow-loop")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 10)
      .attr("refY", 0)
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,-5L10,0L0,5")
      .attr("fill", colors.linkLoop);

    defs
      .append("marker")
      .attr("id", "arrow-backtrack")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 10)
      .attr("refY", 0)
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,-5L10,0L0,5")
      .attr("fill", colors.linkDefault);

    const g = svg.append("g");

    // Apply the calculated transform IMMEDIATELY (no animation)
    const initialTransform = d3.zoomIdentity
      .translate(width / 2, height / 2)
      .scale(scale)
      .translate(-centerX, -centerY);

    g.attr("transform", initialTransform.toString());

    // Zoom behavior
    const zoom = d3.zoom().on("zoom", (event: any) => {
      g.attr("transform", event.transform);
    }) as any;

    svg.call(zoom);
    // Set the initial zoom state so user can zoom from here
    svg.call(zoom.transform, initialTransform);

    // Store references for resetView function
    zoomRef.current = zoom;
    initialTransformRef.current = initialTransform;

    // Links (using line elements with arrow markers)
    const link = g
      .append("g")
      .selectAll("line")
      .data(simLinks)
      .enter()
      .append("line")
      .attr("stroke", (d: WikiLink) =>
        d.type === "loop" ? colors.linkLoop : colors.linkDefault,
      )
      .attr("stroke-width", 2)
      .attr("stroke-dasharray", (d: WikiLink) =>
        d.type === "backtrack" ? "5,5" : "0",
      )
      .attr("marker-end", (d: WikiLink) => {
        if (d.type === "loop") return "url(#arrow-loop)";
        if (d.type === "backtrack") return "url(#arrow-backtrack)";
        return "url(#arrow-default)";
      });

    // Set link positions immediately from pre-calculated positions
    link
      .attr("x1", (d: any) => {
        const dx = d.target.x - d.source.x;
        const dy = d.target.y - d.source.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist === 0) return d.source.x;
        return d.source.x + (dx / dist) * nodeRadius;
      })
      .attr("y1", (d: any) => {
        const dx = d.target.x - d.source.x;
        const dy = d.target.y - d.source.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist === 0) return d.source.y;
        return d.source.y + (dy / dist) * nodeRadius;
      })
      .attr("x2", (d: any) => {
        const dx = d.target.x - d.source.x;
        const dy = d.target.y - d.source.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist === 0) return d.target.x;
        return d.target.x - (dx / dist) * nodeRadius;
      })
      .attr("y2", (d: any) => {
        const dx = d.target.x - d.source.x;
        const dy = d.target.y - d.source.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist === 0) return d.target.y;
        return d.target.y - (dy / dist) * nodeRadius;
      });

    // Nodes
    const node = g
      .append("g")
      .selectAll("g")
      .data(simNodes)
      .enter()
      .append("g")
      .attr("transform", (d: any) => `translate(${d.x},${d.y})`)
      .attr("opacity", (d: WikiNode) => (d.type === "not_found" ? 0.7 : 1))
      .call(
        d3
          .drag<any, any>()
          .on("start", dragstarted)
          .on("drag", dragged)
          .on("end", dragended),
      );

    // Main node circle with colored border based on type
    node
      .append("circle")
      .attr("r", nodeRadius)
      .attr("fill", (d: WikiNode) =>
        d.type === "not_found" ? "#f97316" : colors.defaultNode,
      )
      .attr("stroke", (d: WikiNode) => {
        if (d.type === "current") return "#f59e0b"; // amber-500
        if (d.type === "start") return "#3b82f6"; // blue-500
        if (d.type === "target") return "#10b981"; // green-500
        if (d.type === "failed") return "#ef4444"; // red-500
        if (d.type === "not_found") return "#f97316"; // orange-500
        return colors.nodeStroke;
      })
      .attr("stroke-width", (d: WikiNode) =>
        d.type && (d.type as string) !== "default" ? 2.5 : 1.5,
      );

    node
      .append("text")
      .text((d: WikiNode) => {
        if (d.steps && d.steps.length > 0) {
          return d.steps.join(", ");
        }
        return "";
      })
      .attr("dy", 4)
      .attr("text-anchor", "middle")
      .attr(
        "class",
        isDark
          ? "text-[11px] font-bold fill-white pointer-events-none"
          : "text-[11px] font-bold fill-slate-800 pointer-events-none",
      );

    node
      .append("text")
      .text((d: WikiNode) => d.title)
      .attr("dy", 35)
      .attr("text-anchor", "middle")
      .attr("class", colors.textClass);

    // For drag functionality, we need a live simulation
    const liveSimulation = d3
      .forceSimulation<WikiNode>(simNodes)
      .force(
        "link",
        d3
          .forceLink<WikiNode, WikiLink>(simLinks)
          .id((d: WikiNode) => d.id)
          .distance(linkDistance),
      )
      .force("charge", d3.forceManyBody().strength(chargeStrength))
      .force("collision", d3.forceCollide().radius(collisionRadius))
      .force(
        "x",
        d3
          .forceX((d: any) => {
            if (d.steps && d.steps.length > 0) {
              return d.steps[0] * linkDistance * 1.5;
            }
            return 0;
          })
          .strength(0.5),
      )
      .alphaTarget(0)
      .alpha(0); // Start with no movement

    liveSimulation.on("tick", () => {
      link
        .attr("x1", (d: any) => {
          const dx = d.target.x - d.source.x;
          const dy = d.target.y - d.source.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist === 0) return d.source.x;
          return d.source.x + (dx / dist) * nodeRadius;
        })
        .attr("y1", (d: any) => {
          const dx = d.target.x - d.source.x;
          const dy = d.target.y - d.source.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist === 0) return d.source.y;
          return d.source.y + (dy / dist) * nodeRadius;
        })
        .attr("x2", (d: any) => {
          const dx = d.target.x - d.source.x;
          const dy = d.target.y - d.source.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist === 0) return d.target.x;
          return d.target.x - (dx / dist) * nodeRadius;
        })
        .attr("y2", (d: any) => {
          const dx = d.target.x - d.source.x;
          const dy = d.target.y - d.source.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist === 0) return d.target.y;
          return d.target.y - (dy / dist) * nodeRadius;
        });

      node.attr("transform", (d: any) => `translate(${d.x},${d.y})`);
    });

    function dragstarted(event: any) {
      if (!event.active) liveSimulation.alphaTarget(0.3).restart();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
    }

    function dragged(event: any) {
      event.subject.fx = event.x;
      event.subject.fy = event.y;
    }

    function dragended(event: any) {
      if (!event.active) liveSimulation.alphaTarget(0);
      event.subject.fx = null;
      event.subject.fy = null;
    }

    return () => {
      liveSimulation.stop();
    };
  }, [
    nodes,
    links,
    dimensions,
    theme,
    isDark,
    colors.defaultNode,
    colors.nodeStroke,
    colors.linkDefault,
    colors.linkLoop,
    colors.textClass,
    nodeRadius,
    linkDistance,
    chargeStrength,
    collisionRadius,
  ]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full bg-white dark:bg-neutral-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-inner"
    >
      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
        preserveAspectRatio="xMidYMid meet"
      />
    </div>
  );
});

// Memoize the component to prevent unnecessary re-renders
// Only re-render when nodes or links actually change
export default memo(Graph, (prevProps, nextProps) => {
  // Deep equality check for nodes and links
  if (prevProps.nodes.length !== nextProps.nodes.length) return false;
  if (prevProps.links.length !== nextProps.links.length) return false;

  // Check if node data has changed
  for (let i = 0; i < prevProps.nodes.length; i++) {
    const prev = prevProps.nodes[i];
    const next = nextProps.nodes[i];
    if (
      prev.id !== next.id ||
      prev.title !== next.title ||
      prev.type !== next.type ||
      JSON.stringify(prev.steps) !== JSON.stringify(next.steps)
    ) {
      return false;
    }
  }

  // Check if link data has changed
  for (let i = 0; i < prevProps.links.length; i++) {
    const prev = prevProps.links[i];
    const next = nextProps.links[i];
    if (
      prev.source !== next.source ||
      prev.target !== next.target ||
      prev.type !== next.type
    ) {
      return false;
    }
  }

  // Props are equal, skip re-render
  return true;
});
