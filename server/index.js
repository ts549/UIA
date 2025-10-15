import express from 'express';
import cors from 'cors';

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

// Start server
app.listen(PORT, () => {
  console.log(`UIA Server running on http://localhost:${PORT}`);
});
