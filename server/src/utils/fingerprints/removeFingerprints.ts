import fs from "fs";
import * as parser from "@babel/parser";
import _traverse from '@babel/traverse';
import _generate from '@babel/generator';
import prettier from 'prettier';
import getFiles from "../getFiles.ts";

// Handle default export for CommonJS/ESM compatibility
const traverse = (_traverse as any).default || _traverse;
const generate = (_generate as any).default || _generate;

interface RemoveFingerprintsResult {
  success: boolean;
  file: string;
  fingerprintsRemoved?: number;
  error?: string;
}

/**
 * Removes data-fingerprint attributes from all JSX elements in a file
 */
async function removeFingerprintsFromFile(filePath: string, attributeName: string = 'data-fingerprint'): Promise<RemoveFingerprintsResult> {
  try {
    const code = fs.readFileSync(filePath, 'utf-8');
    let fingerprintsRemoved = 0;

    // Parse the code with TypeScript and JSX support
    const ast = parser.parse(code, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript'],
    });

    // Traverse the AST and remove fingerprint attributes
    traverse(ast, {
      JSXOpeningElement(path: any) {
        const originalLength = path.node.attributes.length;

        // Filter out the fingerprint attribute
        path.node.attributes = path.node.attributes.filter(
          (attr: any) => !(attr.type === 'JSXAttribute' && attr.name.name === attributeName)
        );

        const newLength = path.node.attributes.length;
        fingerprintsRemoved += originalLength - newLength;
      },
    });

    if (fingerprintsRemoved > 0) {
      // Generate the modified code
      const output = generate(ast, {
        retainLines: true,
        compact: false,
      });

      // Format with Prettier before writing
      const fileExtension = filePath.split('.').pop();
      const parserType = fileExtension === 'tsx' ? 'typescript' : 'babel';
      const formattedCode = await prettier.format(output.code, { parser: parserType });

      // Write the modified code back to the file
      fs.writeFileSync(filePath, formattedCode, 'utf-8');

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
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Removes data-fingerprint attributes from all JSX elements in a project
 */
export async function removeFingerprints(rootDir: string, options: {attributeName?: string, extensions?: string[], excludeDirs?: string[]} = {}) {
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
    errors: [] as Array<{ file: string; error: string | undefined }>,
  };

  for (const file of files) {
    console.log(`Processing: ${file}`);
    const result = await removeFingerprintsFromFile(file, attributeName);

    if (result.success) {
      results.processedFiles++;
      results.totalFingerprintsRemoved += result.fingerprintsRemoved ?? 0;
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
