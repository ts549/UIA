import type { Node, Edge, Graph } from './types/types.ts';
import fs from 'fs';

export class GraphStore {
  graph: Graph = { nodes: new Map<string, Node>(), edges: new Map<string, Edge>() }

  addNode(id: string, nodeData?: Partial<Omit<Node, 'id' | 'edges'>>) {
    if (!this.graph.nodes.has(id)) {
      this.graph.nodes.set(id, {
        id,
        name: nodeData?.name || id,
        type: nodeData?.type || 'variable',
        filePath: nodeData?.filePath,
        location: nodeData?.location,
        codeSnippet: nodeData?.codeSnippet,
        props: nodeData?.props,
        edges: { incoming: [], outgoing: [] },
      });
    }
  }

  addEdge(type: Edge["type"], source: string, target: string) {
    const id = `${source}-${type}-${target}`;
    if (this.graph.edges.has(id)) return;

    const edge: Edge = { id, type, source, target };
    this.graph.edges.set(id, edge);

    this.addNode(source);
    this.addNode(target);

    this.graph.nodes.get(source)!.edges.outgoing.push(id);
    this.graph.nodes.get(target)!.edges.incoming.push(id);
  }

  visualize(): void {
    console.log("\n🕸️  Code Graph Visualization\n");

    for (const [, node] of this.graph.nodes) {
      console.log(`📦 Node: ${node.name} (id: ${node.id})`);

      // Retrieve outgoing edges from the node's outgoing list
      if (node.edges.outgoing.length === 0) {
        console.log("   ↳ (no outgoing edges)\n");
        continue;
      }

      for (const edgeId of node.edges.outgoing) {
        const edge = this.graph.edges.get(edgeId);
        if (!edge) continue;

        const targetNode = this.graph.nodes.get(edge.target);
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

  /**
   * Write the graph to a JSON file
   * @param filePath - Absolute path to the output JSON file
   */
  write(filePath: string): void {
    try {
      // Convert Maps to arrays for JSON serialization
      const serializedGraph = {
        nodes: Array.from(this.graph.nodes.entries()),
        edges: Array.from(this.graph.edges.entries()),
      };

      const jsonString = JSON.stringify(serializedGraph, null, 2);
      fs.writeFileSync(filePath, jsonString, 'utf-8');

      console.log(`✅ Graph written to ${filePath}`);
      console.log(`   Nodes: ${this.graph.nodes.size}`);
      console.log(`   Edges: ${this.graph.edges.size}`);
    } catch (error) {
      console.error(`❌ Error writing graph to ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Read the graph from a JSON file
   * @param filePath - Absolute path to the input JSON file
   */
  read(filePath: string): void {
    try {
      if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
      }

      const jsonString = fs.readFileSync(filePath, 'utf-8');
      const serializedGraph = JSON.parse(jsonString);

      // Clear existing graph
      this.graph.nodes.clear();
      this.graph.edges.clear();

      // Reconstruct Maps from arrays
      if (serializedGraph.nodes) {
        for (const [id, node] of serializedGraph.nodes) {
          this.graph.nodes.set(id, node);
        }
      }

      if (serializedGraph.edges) {
        for (const [id, edge] of serializedGraph.edges) {
          this.graph.edges.set(id, edge);
        }
      }

      console.log(`✅ Graph loaded from ${filePath}`);
      console.log(`   Nodes: ${this.graph.nodes.size}`);
      console.log(`   Edges: ${this.graph.edges.size}`);
    } catch (error) {
      console.error(`❌ Error reading graph from ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Clear all nodes and edges from the graph
   */
  clear(): void {
    this.graph.nodes.clear();
    this.graph.edges.clear();
    console.log('🗑️  Graph cleared');
  }
}

export const graphStore = new GraphStore();
