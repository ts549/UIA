import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnFrontend, stopFrontend } from './utils/spawnFrontend.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'UIA Server is running' });
});

// Example API endpoint
app.get('/api/elements', (req, res) => {
  res.json({ elements: [] });
});

app.post('/api/elements', (req, res) => {
  const { element } = req.body;
  res.json({ success: true, element });
});

// Store the frontend process reference
let frontendProcess = null;

// Start server
const server = app.listen(PORT, async () => {
  console.log(`UIA Server running on http://localhost:${PORT}`);
  
  // Start the frontend
  try {
    const frontendPath = path.resolve(__dirname, '../my-app');
    console.log(`Starting frontend from: ${frontendPath}`);
    frontendProcess = await spawnFrontend(frontendPath, { command: 'dev' });
  } catch (error) {
    console.error('Failed to start frontend:', error.message);
  }
});

// Graceful shutdown handler
async function gracefulShutdown(signal) {
  console.log(`\n${signal} received. Shutting down gracefully...`);
  
  // Stop the frontend process
  if (frontendProcess) {
    console.log('Stopping frontend...');
    await stopFrontend(frontendProcess);
  }
  
  console.log('Goodbye!');
  process.exit(0);
}

// Listen for termination signals
process.on('SIGTERM', async () => await gracefulShutdown('SIGTERM'));
process.on('SIGINT', async () => await gracefulShutdown('SIGINT'));

// Handle uncaught errors
process.on('uncaughtException', async (error) => {
  console.error('Uncaught Exception:', error);
  await gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', async (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  await gracefulShutdown('UNHANDLED_REJECTION');
});
