// test.ts - Test file for buildGraphFromFile
import path from 'path';
import { fileURLToPath } from 'url';
import { buildGraphFromFile } from './buildGraphFromFile.ts';
import { graphStore } from './graphStore.ts';
import getFiles from '../getFiles.ts';

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
    buildGraphFromFile(file);
  } catch (error) {
    console.error(`❌ Error processing ${file}:`, error);
  }
});

console.log('\n' + '='.repeat(60));
console.log('✅ Graph building complete!');

// Print code snippet for specific node
console.log('\n' + '='.repeat(60));
console.log('🔍 Code snippet for App.tsx_11_6:\n');

const targetNode = graphStore.graph.nodes.get('App.tsx_11_6');
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
} else {
  console.log('❌ Node App.tsx_11_6 not found in graph');
}
