export interface Edge {
  id: string;
  type: "calls" | "renders" | "binds_event" | "contains" | "references";
  source: string;
  target: string;
}

export interface Node {
  id: string;
  name: string;
  type: "element" | "function" | "prop" | "variable" | "file" | "api";
  filePath?: string;               // source file where defined
  location?: {                     // where in the file
    start: { line: number; column: number };
    end: { line: number; column: number };
  };
  codeSnippet?: string;            // raw code for this node
  props?: Record<string, any>;     // parsed props if applicable (for JSX)
  edges: {
    incoming: string[];
    outgoing: string[];
  };
}

export interface Graph {
  nodes: Map<string, Node>;
  edges: Map<string, Edge>;
}