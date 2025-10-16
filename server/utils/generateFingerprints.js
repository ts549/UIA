import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as parser from '@babel/parser';
import traverse from '@babel/traverse';
import generate from '@babel/generator';
import CryptoJS from 'crypto-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Generates a unique fingerprint ID based on file path, line, and column
 * @param {string} filePath - The file path of the JSX element
 * @param {number} line - Line number in the source file
 * @param {number} column - Column number in the source file
 * @returns {string} A unique fingerprint ID
 */
function generateFingerprintId(filePath, line, column) {
  // Sort keys recursively for deterministic serialization
  const sortKeys = (obj) => {
    if (obj === null || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(sortKeys);
    return Object.keys(obj).sort().reduce((result, key) => {
      result[key] = sortKeys(obj[key]);
      return result;
    }, {});
  };
  
  const data = {
    filePath,
    line,
    column
  };
  
  const sorted = sortKeys(data);
  const normalized = JSON.stringify(sorted);
  console.log('Input:', data);
  console.log('Sorted:', sorted);
  console.log('Normalized:', normalized);
  return CryptoJS.SHA256(normalized).toString(CryptoJS.enc.Hex).slice(0, 12);
}

/**
 * Recursively gets all files with specific extensions in a directory
 * @param {string} dir - Directory to search
 * @param {string[]} extensions - File extensions to include
 * @param {string[]} excludeDirs - Directories to exclude
 * @returns {string[]} Array of file paths
 */
function getFiles(dir, extensions = ['.tsx', '.jsx'], excludeDirs = ['node_modules', 'dist', 'build', '.git']) {
  const files = [];
  
  if (!fs.existsSync(dir)) {
    console.warn(`Directory does not exist: ${dir}`);
    return files;
  }

  const items = fs.readdirSync(dir);

  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      // Skip excluded directories
      if (!excludeDirs.includes(item)) {
        files.push(...getFiles(fullPath, extensions, excludeDirs));
      }
    } else if (stat.isFile()) {
      const ext = path.extname(item);
      if (extensions.includes(ext)) {
        files.push(fullPath);
      }
    }
  }

  return files;
}

/**
 * Adds data-fingerprint attributes to all JSX elements in a file
 * @param {string} filePath - Path to the file
 * @param {string} attributeName - Name of the attribute to add (default: 'data-fingerprint')
 * @returns {object} Object containing success status and fingerprints added
 */
function addFingerprintsToFile(filePath, attributeName = 'data-fingerprint') {
  try {
    const code = fs.readFileSync(filePath, 'utf-8');
    let fingerprintsAdded = 0;
    const fingerprints = [];

    // Parse the code with TypeScript and JSX support
    const ast = parser.parse(code, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript'],
    });

    // Traverse the AST and add fingerprints to JSX elements
    traverse.default(ast, {
      JSXOpeningElement(path) {
        // Check if the element already has the fingerprint attribute
        const hasFingerprint = path.node.attributes.some(
          attr => attr.type === 'JSXAttribute' && attr.name.name === attributeName
        );

        if (!hasFingerprint) {
          // Get the element name for tracking
          const elementName = path.node.name.name || 'Unknown';
          
          // Get location information
          const line = path.node.loc?.start.line || 0;
          const column = path.node.loc?.start.column || 0;
          
          // Generate fingerprint with file path, line, and column
          const fingerprintId = generateFingerprintId(filePath, line, column);
          
          // Create the attribute node
          const attribute = {
            type: 'JSXAttribute',
            name: {
              type: 'JSXIdentifier',
              name: attributeName,
            },
            value: {
              type: 'StringLiteral',
              value: fingerprintId,
            },
          };

          // Add the attribute to the element
          path.node.attributes.push(attribute);
          fingerprintsAdded++;
          
          fingerprints.push({
            id: fingerprintId,
            file: filePath,
            elementName: elementName,
            line: line,
            column: column,
          });
        }
      },
    });

    if (fingerprintsAdded > 0) {
      // Generate the modified code
      const output = generate.default(ast, {
        retainLines: true,
        compact: false,
      });

      // Write the modified code back to the file
      fs.writeFileSync(filePath, output.code, 'utf-8');
      
      return {
        success: true,
        file: filePath,
        fingerprintsAdded,
        fingerprints,
      };
    }

    return {
      success: true,
      file: filePath,
      fingerprintsAdded: 0,
      fingerprints: [],
    };
  } catch (error) {
    return {
      success: false,
      file: filePath,
      error: error.message,
    };
  }
}

/**
 * Removes data-fingerprint attributes from all JSX elements in a file
 * @param {string} filePath - Path to the file
 * @param {string} attributeName - Name of the attribute to remove (default: 'data-fingerprint')
 * @returns {object} Object containing success status and fingerprints removed
 */
function removeFingerprintsFromFile(filePath, attributeName = 'data-fingerprint') {
  try {
    const code = fs.readFileSync(filePath, 'utf-8');
    let fingerprintsRemoved = 0;

    // Parse the code with TypeScript and JSX support
    const ast = parser.parse(code, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript'],
    });

    // Traverse the AST and remove fingerprint attributes
    traverse.default(ast, {
      JSXOpeningElement(path) {
        const originalLength = path.node.attributes.length;
        
        // Filter out the fingerprint attribute
        path.node.attributes = path.node.attributes.filter(
          attr => !(attr.type === 'JSXAttribute' && attr.name.name === attributeName)
        );

        const newLength = path.node.attributes.length;
        fingerprintsRemoved += originalLength - newLength;
      },
    });

    if (fingerprintsRemoved > 0) {
      // Generate the modified code
      const output = generate.default(ast, {
        retainLines: true,
        compact: false,
      });

      // Write the modified code back to the file
      fs.writeFileSync(filePath, output.code, 'utf-8');
      
      return {
        success: true,
        file: filePath,
        fingerprintsRemoved,
      };
    }

    return {
      success: true,
      file: filePath,
      fingerprintsRemoved: 0,
    };
  } catch (error) {
    return {
      success: false,
      file: filePath,
      error: error.message,
    };
  }
}

/**
 * Adds data-fingerprint attributes to all JSX elements in a project
 * @param {string} rootDir - Root directory of the project
 * @param {object} options - Options
 * @param {string} options.attributeName - Name of the attribute to add (default: 'data-fingerprint')
 * @param {string[]} options.extensions - File extensions to process (default: ['.tsx', '.jsx'])
 * @param {string[]} options.excludeDirs - Directories to exclude (default: ['node_modules', 'dist', 'build', '.git'])
 * @returns {object} Summary of the operation
 */
export function addFingerprints(rootDir, options = {}) {
  const {
    attributeName = 'data-fingerprint',
    extensions = ['.tsx', '.jsx'],
    excludeDirs = ['node_modules', 'dist', 'build', '.git'],
  } = options;

  console.log(`Adding fingerprints to project: ${rootDir}`);
  console.log(`Attribute name: ${attributeName}`);

  const files = getFiles(rootDir, extensions, excludeDirs);
  console.log(`Found ${files.length} files to process`);

  const results = {
    totalFiles: files.length,
    processedFiles: 0,
    failedFiles: 0,
    totalFingerprintsAdded: 0,
    allFingerprints: [],
    errors: [],
  };

  for (const file of files) {
    console.log(`Processing: ${file}`);
    const result = addFingerprintsToFile(file, attributeName);

    if (result.success) {
      results.processedFiles++;
      results.totalFingerprintsAdded += result.fingerprintsAdded;
      results.allFingerprints.push(...result.fingerprints);
    } else {
      results.failedFiles++;
      results.errors.push({
        file,
        error: result.error,
      });
      console.error(`Failed to process ${file}: ${result.error}`);
    }
  }

  console.log('\n--- Summary ---');
  console.log(`Total files found: ${results.totalFiles}`);
  console.log(`Successfully processed: ${results.processedFiles}`);
  console.log(`Failed: ${results.failedFiles}`);
  console.log(`Total fingerprints added: ${results.totalFingerprintsAdded}`);

  return results;
}

/**
 * Removes data-fingerprint attributes from all JSX elements in a project
 * @param {string} rootDir - Root directory of the project
 * @param {object} options - Options
 * @param {string} options.attributeName - Name of the attribute to remove (default: 'data-fingerprint')
 * @param {string[]} options.extensions - File extensions to process (default: ['.tsx', '.jsx'])
 * @param {string[]} options.excludeDirs - Directories to exclude (default: ['node_modules', 'dist', 'build', '.git'])
 * @returns {object} Summary of the operation
 */
export function removeFingerprints(rootDir, options = {}) {
  const {
    attributeName = 'data-fingerprint',
    extensions = ['.tsx', '.jsx'],
    excludeDirs = ['node_modules', 'dist', 'build', '.git'],
  } = options;

  console.log(`Removing fingerprints from project: ${rootDir}`);
  console.log(`Attribute name: ${attributeName}`);

  const files = getFiles(rootDir, extensions, excludeDirs);
  console.log(`Found ${files.length} files to process`);

  const results = {
    totalFiles: files.length,
    processedFiles: 0,
    failedFiles: 0,
    totalFingerprintsRemoved: 0,
    errors: [],
  };

  for (const file of files) {
    console.log(`Processing: ${file}`);
    const result = removeFingerprintsFromFile(file, attributeName);

    if (result.success) {
      results.processedFiles++;
      results.totalFingerprintsRemoved += result.fingerprintsRemoved;
    } else {
      results.failedFiles++;
      results.errors.push({
        file,
        error: result.error,
      });
      console.error(`Failed to process ${file}: ${result.error}`);
    }
  }

  console.log('\n--- Summary ---');
  console.log(`Total files found: ${results.totalFiles}`);
  console.log(`Successfully processed: ${results.processedFiles}`);
  console.log(`Failed: ${results.failedFiles}`);
  console.log(`Total fingerprints removed: ${results.totalFingerprintsRemoved}`);

  return results;
}

// Example usage (commented out)
/*
const projectRoot = path.resolve(__dirname, '../../my-app');

// Add fingerprints
const addResults = addFingerprints(projectRoot);
console.log('Add results:', addResults);

// Remove fingerprints
const removeResults = removeFingerprints(projectRoot);
console.log('Remove results:', removeResults);
*/
