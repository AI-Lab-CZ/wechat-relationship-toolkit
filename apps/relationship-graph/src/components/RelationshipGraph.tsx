import { useEffect, useMemo, useRef } from "react";
import * as d3 from "d3";
import { GraphEdge, GraphNode } from "../data/graphData.js";

interface RelationshipGraphProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  selectedNodeId: string;
  onSelectNode: (node: GraphNode) => void;
}

const relationColors: Record<string, string> = {
  self: "#818cf8",
  customer: "#22d3ee",
  supplier: "#fb923c",
  business: "#10b981",
  business_group: "#34d399",
  family: "#fbbf24",
  brother: "#3b82f6",
  romance: "#fb7185",
  group: "#a78bfa",
  weak: "#64748b",
};

function colorFor(category: string) {
  return relationColors[category] || "#94a3b8";
}

export default function RelationshipGraph({
  nodes,
  edges,
  selectedNodeId,
  onSelectNode,
}: RelationshipGraphProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const graphData = useMemo(() => ({
    nodes: nodes.map((node) => ({ ...node })),
    edges: edges.map((edge) => ({ ...edge })),
  }), [nodes, edges]);

  useEffect(() => {
    const svgElement = svgRef.current;
    const wrapElement = wrapRef.current;
    if (!svgElement || !wrapElement) return;

    const width = wrapElement.clientWidth || 760;
    const height = wrapElement.clientHeight || 560;
    const svg = d3.select(svgElement);
    svg.selectAll("*").remove();
    svg.attr("viewBox", `0 0 ${width} ${height}`);

    const defs = svg.append("defs");
    const glow = defs.append("filter")
      .attr("id", "node-glow")
      .attr("x", "-60%")
      .attr("y", "-60%")
      .attr("width", "220%")
      .attr("height", "220%");
    glow.append("feGaussianBlur").attr("stdDeviation", "4").attr("result", "blur");
    const merge = glow.append("feMerge");
    merge.append("feMergeNode").attr("in", "blur");
    merge.append("feMergeNode").attr("in", "SourceGraphic");

    const grid = defs.append("pattern")
      .attr("id", "graph-grid")
      .attr("width", 48)
      .attr("height", 48)
      .attr("patternUnits", "userSpaceOnUse");
    grid.append("path")
      .attr("d", "M 48 0 L 0 0 0 48")
      .attr("fill", "none")
      .attr("stroke", "rgba(148, 163, 184, 0.08)")
      .attr("stroke-width", 1);

    svg.append("rect")
      .attr("width", width)
      .attr("height", height)
      .attr("fill", "url(#graph-grid)");

    const canvas = svg.append("g");
    svg.call(
      d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.5, 2.4])
        .on("zoom", (event) => canvas.attr("transform", event.transform)),
    );

    const nodeById = new Map(graphData.nodes.map((node) => [node.id, node]));
    const links = graphData.edges
      .filter((edge) => nodeById.has(edge.source) && nodeById.has(edge.target))
      .map((edge) => ({
        ...edge,
        source: edge.source,
        target: edge.target,
      }));

    const simulation = d3.forceSimulation(graphData.nodes as any)
      .force("link", d3.forceLink(links as any).id((node: any) => node.id).distance((edge: any) => Math.max(90, 170 - edge.strength)))
      .force("charge", d3.forceManyBody().strength((node: any) => node.id === "me" ? -900 : -180))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("radial", d3.forceRadial((node: any) => {
        if (node.id === "me") return 0;
        if (["family", "brother", "romance"].includes(node.category)) return 130;
        if (["customer", "supplier", "business", "business_group"].includes(node.category)) return 220;
        return 300;
      }, width / 2, height / 2).strength(0.75))
      .force("collide", d3.forceCollide().radius((node: any) => node.id === "me" ? 42 : 28));

    const link = canvas.append("g")
      .attr("fill", "none")
      .selectAll("path")
      .data(links)
      .join("path")
      .attr("stroke", (edge: any) => colorFor(edge.relation))
      .attr("stroke-width", (edge: any) => Math.max(1.5, edge.strength / 22))
      .attr("stroke-opacity", (edge: any) => edge.confidence < 0.6 ? 0.35 : 0.72)
      .attr("stroke-dasharray", (edge: any) => edge.confidence < 0.6 ? "5 5" : null);

    const node = canvas.append("g")
      .selectAll("g")
      .data(graphData.nodes)
      .join("g")
      .attr("cursor", "pointer")
      .call(d3.drag<any, any>()
        .on("start", (event, datum: any) => {
          if (!event.active) simulation.alphaTarget(0.25).restart();
          datum.fx = datum.x;
          datum.fy = datum.y;
        })
        .on("drag", (event, datum: any) => {
          datum.fx = event.x;
          datum.fy = event.y;
        })
        .on("end", (event, datum: any) => {
          if (!event.active) simulation.alphaTarget(0);
          datum.fx = null;
          datum.fy = null;
        }))
      .on("click", (_event, datum) => onSelectNode(datum));

    node.append("circle")
      .attr("r", (datum) => datum.id === "me" ? 24 : Math.max(13, 11 + datum.value_score / 12))
      .attr("fill", (datum) => colorFor(datum.category))
      .attr("fill-opacity", (datum) => datum.id === "me" ? 0.95 : 0.2)
      .attr("stroke", (datum) => datum.id === selectedNodeId ? "#ffffff" : colorFor(datum.category))
      .attr("stroke-width", (datum) => datum.id === selectedNodeId ? 3 : 1.8)
      .style("filter", (datum) => datum.id === selectedNodeId || datum.value_score >= 80 ? "url(#node-glow)" : null);

    node.append("text")
      .text((datum) => datum.label)
      .attr("x", 0)
      .attr("y", (datum) => datum.id === "me" ? 42 : 35)
      .attr("text-anchor", "middle")
      .attr("fill", "#e2e8f0")
      .attr("font-size", 12)
      .attr("font-weight", (datum) => datum.id === selectedNodeId ? 700 : 500)
      .attr("paint-order", "stroke")
      .attr("stroke", "#07101e")
      .attr("stroke-width", 4);

    node.append("title")
      .text((datum) => `${datum.label}\n${datum.summary}`);

    simulation.on("tick", () => {
      link.attr("d", (edge: any) => {
        const source = edge.source;
        const target = edge.target;
        const dx = target.x - source.x;
        const dy = target.y - source.y;
        const curve = Math.sqrt(dx * dx + dy * dy) * 0.18;
        return `M${source.x},${source.y} Q${(source.x + target.x) / 2},${(source.y + target.y) / 2 - curve} ${target.x},${target.y}`;
      });
      node.attr("transform", (datum: any) => `translate(${datum.x},${datum.y})`);
    });

    return () => {
      simulation.stop();
    };
  }, [graphData, onSelectNode, selectedNodeId]);

  return (
    <div ref={wrapRef} className="relative h-[560px] overflow-hidden rounded-lg border border-slate-800 bg-[#050914]">
      <svg ref={svgRef} className="h-full w-full" />
      <div className="absolute bottom-4 right-4 rounded-lg border border-slate-800 bg-slate-950/90 p-3 text-xs text-slate-300">
        <div className="mb-2 font-semibold text-slate-100">图谱图示</div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          <Legend color="bg-emerald-400" label="商圈" />
          <Legend color="bg-amber-400" label="亲人" />
          <Legend color="bg-blue-400" label="朋友" />
          <Legend color="bg-rose-400" label="亲密" />
          <Legend color="bg-violet-400" label="群聊" />
          <Legend color="bg-slate-400" label="弱关系" />
        </div>
      </div>
      <div className="absolute bottom-4 left-4 max-w-sm rounded-lg border border-slate-800 bg-slate-950/90 p-3 text-xs leading-5 text-slate-400">
        拖拽节点可微调布局，滚轮可缩放。低置信度关系会显示为虚线。
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-2">
      <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
      {label}
    </span>
  );
}
