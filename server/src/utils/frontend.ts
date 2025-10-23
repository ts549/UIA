import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { addFingerprints } from './fingerprints/addFingerprints.ts';
import { removeFingerprints } from './fingerprints/removeFingerprints.ts';
import { buildGraph } from './graph/buildGraph.ts';
import type { ChildProcess } from 'child_process';

// Extend ChildProcess to include custom properties
interface ExtendedChildProcess extends ChildProcess {
  projectRootDir?: string;
  fingerprintAttributeName?: string;
}

/**
 * Spawns a React project as a subprocess
 */
async function spawnFrontend(rootDir: string,
                            options: {command?: string, silent?: boolean, attributeName?: string} = {}): Promise<ChildProcess> {

  const { command = 'dev', silent = false, attributeName = 'data-fingerprint' } = options;

  // Validate that the directory exists
  if (!fs.existsSync(rootDir)) {
    throw new Error(`Directory not found: ${rootDir}`);
  }

  // Check if package.json exists
  const packageJsonPath = path.join(rootDir, 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    throw new Error(`package.json not found in: ${rootDir}`);
  }

  // Generate fingerprints before spawning
  console.log('\n=== Generating Fingerprints ===');
  try {
    const fingerprintResults = addFingerprints(rootDir, { attributeName });
    console.log(`✓ Fingerprints generated: ${fingerprintResults.totalFingerprintsAdded} attributes added`);
    
    // Build graph and write to graph.json instead of fingerprints.json
    console.log('\n=== Building Code Graph ===');
    const srcDir = path.join(rootDir, 'src');
    buildGraph(srcDir);
    console.log('✓ Graph built and written to graph.json');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('⚠ Warning: Failed to generate fingerprints or build graph:', errorMessage);
    console.log('Continuing with spawn...');
  }
  console.log('================================\n');

  return new Promise((resolve, reject) => {
    // Determine the npm command based on OS
    const isWindows = process.platform === 'win32';
    const npmCommand = isWindows ? 'npm.cmd' : 'npm';

    // Spawn the process
    const child = spawn(npmCommand, ['run', command], {
      cwd: rootDir,
      stdio: silent ? 'ignore' : 'pipe',
      shell: isWindows
    });

    if (!silent) {
      // Pipe stdout
      child.stdout?.on('data', (data) => {
        console.log(`[Frontend]: ${data.toString().trim()}`);
      });

      // Pipe stderr
      child.stderr?.on('data', (data) => {
        console.error(`[Frontend Error]: ${data.toString().trim()}`);
      });
    }

    // Handle process exit
    child.on('exit', (code, signal) => {
      if (code !== 0 && code !== null) {
        console.log(`Frontend process exited with code ${code}`);
      }
      if (signal) {
        console.log(`Frontend process killed with signal ${signal}`);
      }
    });

    // Handle errors
    child.on('error', (error) => {
      console.error('Failed to start frontend process:', error);
      reject(error);
    });

    // Wait a bit to ensure the process started successfully
    setTimeout(() => {
      if (child.exitCode === null) {
        console.log(`Frontend started successfully in: ${rootDir}`);
        // Attach the rootDir and attributeName to the child process for later use
        const extendedChild = child as ExtendedChildProcess;
        extendedChild.projectRootDir = rootDir;
        extendedChild.fingerprintAttributeName = attributeName;
        resolve(extendedChild);
      } else {
        reject(new Error(`Frontend process exited immediately with code ${child.exitCode}`));
      }
    }, 1000);
  });
}

/**
 * Stops a running frontend process and removes fingerprints
 */
async function stopFrontend(process: ExtendedChildProcess): Promise<void> {
  if (!process || process.exitCode !== null) {
    return;
  }

  return new Promise<void>((resolve) => {
    process.on('exit', async () => {
      console.log('Frontend process stopped');
      
      // Remove fingerprints after process is killed
      if (process.projectRootDir) {
        console.log('\n=== Removing Fingerprints ===');
        try {
          const removeResults = removeFingerprints(
            process.projectRootDir,
            { attributeName: process.fingerprintAttributeName || 'data-fingerprint' }
          );
          console.log(`✓ Fingerprints removed: ${removeResults.totalFingerprintsRemoved} attributes removed`);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.error('⚠ Warning: Failed to remove fingerprints:', errorMessage);
        }
        console.log('================================\n');
      }
      
      resolve();
    });

    // Kill the process
    process.kill('SIGTERM');

    // Force kill after 5 seconds if not stopped
    setTimeout(() => {
      if (process.exitCode === null) {
        console.log('Force killing frontend process');
        process.kill('SIGKILL');
      }
    }, 5000);
  });
}

export { spawnFrontend, stopFrontend };
