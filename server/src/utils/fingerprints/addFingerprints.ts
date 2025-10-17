import fs from 'fs';
import * as parser from '@babel/parser';
import _traverse from '@babel/traverse';
import _generate from '@babel/generator';
import generateFingerprintId from './generateFingerprintId.ts';
import getFiles from '../getFiles.ts';

// Handle default export for CommonJS/ESM compatibility
const traverse = (_traverse as any).default || _traverse;
const generate = (_generate as any).default || _generate;

/**
 * Adds data-fingerprint attributes to all JSX elements in a file
 * @returns {object} Object containing success status and fingerprints added
 */
function addFingerprintsToFile(filePath: string, attributeName: string = 'data-fingerprint') {
  try {
    const code = fs.readFileSync(filePath, 'utf-8');
    let fingerprintsAdded = 0;
    const fingerprints: Array<{
      id: string;
      file: string;
      elementName: string;
      line: number;
      column: number;
    }> = [];

    // Parse the code with TypeScript and JSX support
    const ast = parser.parse(code, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript'],
    });

    // Traverse the AST and add fingerprints to JSX elements
    traverse(ast, {
      JSXOpeningElement(path: any) {
        // Check if the element already has the fingerprint attribute
        const hasFingerprint = path.node.attributes.some(
          (attr: any) => attr.type === 'JSXAttribute' && attr.name.name === attributeName
        );

        if (!hasFingerprint) {
          // Get the element name for tracking
          let elementName = 'Unknown';
          if (path.node.name.type === 'JSXIdentifier') {
            elementName = path.node.name.name;
          } else if (path.node.name.type === 'JSXMemberExpression') {
            // For member expressions like Component.SubComponent
            elementName = generate(path.node.name).code;
          } else if (path.node.name.type === 'JSXNamespacedName') {
            // For namespaced names like namespace:element
            elementName = `${path.node.name.namespace.name}:${path.node.name.name.name}`;
          }

          // Get location information
          const line = path.node.loc?.start.line || 0;
          const column = path.node.loc?.start.column || 0;

          // Generate fingerprint with file path, line, and column
          const fingerprintId = generateFingerprintId(filePath, line, column);

          // Create the attribute node
          const attribute = {
            type: 'JSXAttribute' as const,
            name: {
              type: 'JSXIdentifier' as const,
              name: attributeName,
            },
            value: {
              type: 'StringLiteral' as const,
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
      const output = generate(ast, {
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
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Adds data-fingerprint attributes to all JSX elements in a project
 */
export function addFingerprints(rootDir: string, options: {attributeName?: string, extensions?: string[], excludeDirs?: string[]} = {}) {
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
    allFingerprints: [] as any[],
    errors: [] as Array<{ file: string; error: string | undefined }>,
  };

  for (const file of files) {
    console.log(`Processing: ${file}`);
    const result = addFingerprintsToFile(file, attributeName);

    if (result.success) {
      results.processedFiles++;
      results.totalFingerprintsAdded += result.fingerprintsAdded ?? 0;
      results.allFingerprints.push(...(result.fingerprints ?? []));
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

