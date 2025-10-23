import path from 'path';
import { fileURLToPath } from 'url';
import { parseNodes } from './parseNodes.ts';
import { graphStore } from './graphStore.ts';
import getFiles from '../getFiles.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Build the code graph from all files in a given root directory
 * @param rootPath - Absolute path to the root directory to analyze
 */
export function buildGraph(rootPath?: string): void {
    // Validate root path
    if (!rootPath) {
        throw new Error('root path does not exist');
    }

    // Get all TypeScript/JavaScript React files
    const files = getFiles(rootPath, ['.tsx', '.ts', '.jsx', '.js'], ['node_modules', 'dist', 'build']);

    console.log(`Found ${files.length} files to analyze`);

    // Clear existing graph before building
    graphStore.clear();

    // Build graph from each file
    files.forEach((file) => {
        try {
        parseNodes(file);
        } catch (error) {
        console.error(`Error processing ${file}:`, error);
        }
    });

    console.log(`✅ Graph built successfully`);
    console.log(`   Nodes: ${graphStore.graph.nodes.size}`);
    console.log(`   Edges: ${graphStore.graph.edges.size}`);

    // Write graph to graph.json (same location as fingerprints.json - server directory)
    const graphFilePath = path.resolve(__dirname, '../../../graph.json');
    graphStore.write(graphFilePath);
}
