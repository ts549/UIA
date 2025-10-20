import { Router } from 'express';
import type { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildGraphFromFile } from '../utils/graph/buildGraphFromFile.ts';
import { graphStore } from '../utils/graph/graphStore.ts';
import getFiles from '../utils/getFiles.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = Router();

// POST endpoint - receives fingerprint and message, builds graph, returns node details
router.post('/', (req: Request, res: Response) => {
  const { fingerprintId, message } = req.body;

  console.log(fingerprintId);
  console.log(message);

  if (!fingerprintId || !message) {
    return res.status(400).json({ 
      error: 'Missing required fields: fingerprintId and message are required' 
    });
  }

  try {
    console.log('Received prompt request:', { fingerprintId, message });

    // First, get the file path from fingerprints.json
    const fingerprintsPath = path.resolve(__dirname, '../../fingerprints.json');
    
    if (!fs.existsSync(fingerprintsPath)) {
      return res.status(404).json({ error: 'Fingerprints file not found' });
    }
    
    const fingerprintsData = fs.readFileSync(fingerprintsPath, 'utf-8');
    const fingerprints = JSON.parse(fingerprintsData);
    
    // Check if the fingerprint ID exists
    if (!fingerprints[fingerprintId]) {
      return res.status(404).json({ error: 'Fingerprint not found' });
    }

    const fingerprintInfo = fingerprints[fingerprintId];
    const filePath = fingerprintInfo.file;

    // Build the graph from all files in the frontend repository
    console.log('Building graph from frontend repository');
    
    // Get the frontend root directory (my-app/src)
    const frontendRoot = path.resolve(__dirname, '../../../my-app/src');
    
    // Get all TypeScript/JavaScript React files
    const files = getFiles(frontendRoot, ['.tsx', '.ts', '.jsx', '.js'], ['node_modules', 'dist', 'build']);
    
    console.log(`Found ${files.length} files to analyze`);
    
    // Build graph from each file
    files.forEach((file) => {
      try {
        buildGraphFromFile(file);
      } catch (error) {
        console.error(`Error processing ${file}:`, error);
      }
    });

    // Search for the node in the graph
    const node = graphStore.graph.nodes.get(fingerprintId);

    if (!node) {
      return res.status(404).json({ 
        error: 'Node not found in graph',
        fingerprintId,
        filePath
      });
    }

    // Build context message based on template
    let promptMessage = `User intent: ${message}\n\n`;
    
    // Main element
    promptMessage += `Main element: ${node.codeSnippet || node.name}\n`;
    promptMessage += `id: ${node.id}\n`;
    promptMessage += `File: ${node.filePath || 'unknown'}\n\n`;

    // Recursively find all parent elements up to the root
    const getAllParents = (currentNode: any, depth: number = 0): void => {
      if (depth > 20) return; // Prevent infinite loops
      
      const parentEdges = currentNode.edges.incoming
        .map((edgeId: string) => graphStore.graph.edges.get(edgeId))
        .filter((edge: any) => edge && edge.type === 'contains');
      
      if (parentEdges.length > 0) {
        const parentEdge = parentEdges[0];
        const parentNode = graphStore.graph.nodes.get(parentEdge!.source);
        if (parentNode) {
          const level = depth === 0 ? 'Parent' : `Parent (level ${depth + 1})`;
          promptMessage += `${level} element: ${parentNode.codeSnippet || parentNode.name}\n`;
          promptMessage += `id: ${parentNode.id}\n`;
          promptMessage += `File: ${parentNode.filePath || 'unknown'}\n\n`;
          
          // Recursively get parent's parent
          getAllParents(parentNode, depth + 1);
        }
      }
    };

    getAllParents(node);

    // Find function calls (outgoing "calls" edges)
    const callEdges = node.edges.outgoing
      .map(edgeId => graphStore.graph.edges.get(edgeId))
      .filter(edge => edge && edge.type === 'calls');
    
    for (const callEdge of callEdges) {
      if (callEdge) {
        const calledNode = graphStore.graph.nodes.get(callEdge.target);
        if (calledNode) {
          promptMessage += `Calls: ${calledNode.name}\n`;
          promptMessage += `id: ${calledNode.id}\n`;
          promptMessage += `File: ${calledNode.filePath || 'unknown'}\n\n`;
        }
      }
    }

    // Find resource dependencies (outgoing "references" edges)
    const refEdges = node.edges.outgoing
      .map(edgeId => graphStore.graph.edges.get(edgeId))
      .filter(edge => edge && edge.type === 'references');
    
    for (const refEdge of refEdges) {
      if (refEdge) {
        const refNode = graphStore.graph.nodes.get(refEdge.target);
        if (refNode) {
          promptMessage += `Uses: ${refNode.name}\n`;
          promptMessage += `id: ${refNode.id}\n`;
          promptMessage += `File: ${refNode.filePath || 'unknown'}\n\n`;
        } else {
          // If node doesn't exist, it's likely a string literal (file path)
          promptMessage += `Uses: ${refEdge.target}\n`;
          promptMessage += `id: ${refEdge.target}\n\n`;
        }
      }
    }

    // Return the formatted message
    res.json({
      success: true,
      promptMessage: promptMessage.trim()
    });

  } catch (error) {
    console.error('Error processing prompt:', error);
    res.status(500).json({ 
      error: 'Failed to process prompt',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

export default router;