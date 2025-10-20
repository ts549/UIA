import type { Graph } from "./types/types.ts";

export function visualizeGraph(graph: Graph): void {
  console.log("\n🕸️  Code Graph Visualization\n");

  for (const [, node] of graph.nodes) {
    console.log(`📦 Node: ${node.name} (id: ${node.id})`);

    // Retrieve outgoing edges from the node’s outgoing list
    if (node.edges.outgoing.length === 0) {
      console.log("   ↳ (no outgoing edges)\n");
      continue;
    }

    for (const edgeId of node.edges.outgoing) {
      const edge = graph.edges.get(edgeId);
      if (!edge) continue;

      const targetNode = graph.nodes.get(edge.target);
      const typeIcon =
        edge.type === "calls"
          ? "📞"
          : edge.type === "renders"
          ? "🎨"
          : edge.type === "binds_event"
          ? "🖱️"
          : edge.type === "contains"
          ? "📦"
          : edge.type === "references"
          ? "🔗"
          : "➡️";

      console.log(
        `   ${typeIcon}  ${edge.type.padEnd(12)} → ${
          targetNode?.name || "Unknown"
        } (id: ${edge.target})`
      );
    }

    console.log();
  }
}