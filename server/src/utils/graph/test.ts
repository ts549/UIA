// test.ts - Test file for buildGraphFromFile
import path from 'path';
import { fileURLToPath } from 'url';
import { parseNodes } from './parseNodes.ts';
import { graphStore } from './graphStore.ts';
import getFiles from '../getFiles.ts';
import generateFingerprintId from '../fingerprints/generateFingerprintId.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to the my-app frontend root
const myAppRoot = path.resolve(__dirname, '../../../../my-app/src');

console.log('🔍 Analyzing React application at:', myAppRoot);
console.log('=' .repeat(60));

// Get all TypeScript/JavaScript React files
const files = getFiles(myAppRoot, ['.tsx', '.ts', '.jsx', '.js'], ['node_modules', 'dist', 'build']);

console.log(`\n📁 Found ${files.length} files to analyze:\n`);
files.forEach((file, index) => {
  console.log(`${index + 1}. ${path.relative(myAppRoot, file)}`);
});

console.log('\n' + '='.repeat(60));
console.log('🏗️  Building code graph...\n');

// Build graph from each file
files.forEach((file) => {
  console.log(`\n📄 Processing: ${path.relative(myAppRoot, file)}`);
  console.log('-'.repeat(60));
  try {
    parseNodes(file);
  } catch (error) {
    console.error(`❌ Error processing ${file}:`, error);
  }
});

console.log('\n' + '='.repeat(60));
console.log('✅ Graph building complete!');

// Print code snippet for specific node
console.log('\n' + '='.repeat(60));
console.log('🔍 Code snippet for img element (Vite logo) in App.tsx at line 13, col 10:\n');

// Generate fingerprint for App.tsx line 13, col 10
const appTsxPath = path.resolve(myAppRoot, 'App.tsx');
const imgFingerprint = generateFingerprintId(appTsxPath, 13, 10);

const targetNode = graphStore.graph.nodes.get(imgFingerprint);
if (targetNode) {
  console.log(`Node ID: ${targetNode.id}`);
  console.log(`Name: ${targetNode.name}`);
  console.log(`Type: ${targetNode.type}`);
  console.log(`File: ${targetNode.filePath}`);
  console.log(`Location: Line ${targetNode.location?.start.line}, Col ${targetNode.location?.start.column}`);
  console.log(`\nCode Snippet:`);
  console.log('-'.repeat(60));
  console.log(targetNode.codeSnippet);
  console.log('-'.repeat(60));
  if (targetNode.props && Object.keys(targetNode.props).length > 0) {
    console.log(`\nProps:`, JSON.stringify(targetNode.props, null, 2));
  }

  // Find and log parent node
  console.log('\n' + '='.repeat(60));
  console.log('📦 Parent Node Information:\n');
  
  const parentEdges = targetNode.edges.incoming
    .map(edgeId => graphStore.graph.edges.get(edgeId))
    .filter(edge => edge && edge.type === 'contains');
  
  if (parentEdges.length > 0) {
    const parentEdge = parentEdges[0];
    const parentNode = graphStore.graph.nodes.get(parentEdge!.source);
    
    if (parentNode) {
      console.log(`Parent Node ID: ${parentNode.id}`);
      console.log(`Name: ${parentNode.name}`);
      console.log(`Type: ${parentNode.type}`);
      console.log(`File: ${parentNode.filePath}`);
      console.log(`Location: Line ${parentNode.location?.start.line}, Col ${parentNode.location?.start.column}`);
      console.log(`\nParent Code Snippet:`);
      console.log('-'.repeat(60));
      console.log(parentNode.codeSnippet);
      console.log('-'.repeat(60));
    } else {
      console.log('❌ Parent node not found in graph');
    }
  } else {
    console.log('ℹ️  No parent element (this is a root element)');
  }
} else {
  console.log(`❌ Node with fingerprint ${imgFingerprint} not found in graph`);
}
