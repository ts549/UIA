import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { addFingerprints, removeFingerprints } from './generateFingerprints.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Spawns a React project as a subprocess
 * @param {string} rootDir - The root directory of the React project
 * @param {object} options - Optional configuration
 * @param {string} options.command - The npm command to run (default: 'dev')
 * @param {boolean} options.silent - Whether to suppress output (default: false)
 * @param {string} options.attributeName - Custom fingerprint attribute name (default: 'data-fingerprint')
 * @returns {Promise<ChildProcess>} - Returns the spawned child process
 */
async function spawnFrontend(rootDir, options = {}) {
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
    
    // Write fingerprints to fingerprints.json
    const fingerprintsMap = {};
    fingerprintResults.allFingerprints.forEach(fp => {
      fingerprintsMap[fp.id] = {
        file: fp.file,
        elementName: fp.elementName,
        line: fp.line,
        column: fp.column
      };
    });
    
    const fingerprintsFilePath = './fingerprints.json';
    fs.writeFileSync(fingerprintsFilePath, JSON.stringify(fingerprintsMap, null, 2), 'utf-8');
    console.log(`✓ Fingerprints written to: ${fingerprintsFilePath}`);
  } catch (error) {
    console.error('⚠ Warning: Failed to generate fingerprints:', error.message);
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
      child.stdout.on('data', (data) => {
        console.log(`[Frontend]: ${data.toString().trim()}`);
      });

      // Pipe stderr
      child.stderr.on('data', (data) => {
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
        child.projectRootDir = rootDir;
        child.fingerprintAttributeName = attributeName;
        resolve(child);
      } else {
        reject(new Error(`Frontend process exited immediately with code ${child.exitCode}`));
      }
    }, 1000);
  });
}

/**
 * Stops a running frontend process and removes fingerprints
 * @param {ChildProcess} process - The child process to stop
 * @returns {Promise<void>}
 */
async function stopFrontend(process) {
  if (!process || process.exitCode !== null) {
    return;
  }

  return new Promise((resolve) => {
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
          console.error('⚠ Warning: Failed to remove fingerprints:', error.message);
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
