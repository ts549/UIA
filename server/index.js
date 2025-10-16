import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
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

// Fingerprint endpoint - returns data for a specific fingerprint ID
app.get('/api/fingerprint/:id', (req, res) => {
  const { id } = req.params;
  
  try {
    const fingerprintsPath = path.resolve(__dirname, 'fingerprints.json');
    
    // Check if fingerprints.json exists
    if (!fs.existsSync(fingerprintsPath)) {
      return res.status(404).json({ error: 'Fingerprints file not found' });
    }
    
    const fingerprintsData = fs.readFileSync(fingerprintsPath, 'utf-8');
    const fingerprints = JSON.parse(fingerprintsData);
    
    // Check if the fingerprint ID exists
    if (!fingerprints[id]) {
      return res.status(404).json({ error: 'Fingerprint not found' });
    }
    
    res.json(fingerprints[id]);
  } catch (error) {
    console.error('Error reading fingerprints:', error);
    res.status(500).json({ error: 'Failed to read fingerprint data' });
  }
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
  
  // Close the Express server
  console.log('Stopping Express server...');
  server.close(() => {
    console.log('Express server closed');
    console.log('Goodbye!');
    process.exit(0);
  });
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
