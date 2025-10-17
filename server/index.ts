import path from 'path';
import { fileURLToPath } from 'url';
import { spawnFrontend } from './src/utils/frontend.ts';
import app from './src/app.ts';
import gracefulShutdown from './src/utils/gracefulShutdown.ts';
import type { ChildProcess } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3001;

// Store the frontend process reference
let frontendProcess: ChildProcess | null = null;

// Start server
const server = app.listen(PORT, async () => {
  console.log(`UIA Server running on http://localhost:${PORT}`);
  
  // Start the frontend
  try {
    const frontendPath = path.resolve(__dirname, '../my-app');
    console.log(`Starting frontend from: ${frontendPath}`);
    frontendProcess = await spawnFrontend(frontendPath, { command: 'dev' });
  } catch (error) {
    console.error('Failed to start frontend:', error instanceof Error ? error.message : String(error));
  }
});

// Listen for termination signals
process.on('SIGTERM', async () => await gracefulShutdown('SIGTERM', frontendProcess, server));
process.on('SIGINT', async () => await gracefulShutdown('SIGINT', frontendProcess, server));

// Handle uncaught errors
process.on('uncaughtException', async (error) => {
  console.error('Uncaught Exception:', error);
  await gracefulShutdown('UNCAUGHT_EXCEPTION', frontendProcess, server);
});

process.on('unhandledRejection', async (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  await gracefulShutdown('UNHANDLED_REJECTION', frontendProcess, server);
});
