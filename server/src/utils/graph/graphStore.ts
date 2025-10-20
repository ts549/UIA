import type { Node, Edge, Graph } from './types/types.ts';

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
}

export const graphStore = new GraphStore();
