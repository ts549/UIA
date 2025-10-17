import { Router } from 'express';
import type { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = Router();

// Fingerprint endpoint - returns data for a specific fingerprint ID
router.get('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  
  try {
    // From server/src/routes/ -> server/fingerprints.json (go up 2 levels)
    const fingerprintsPath = path.resolve(__dirname, '../../fingerprints.json');
    
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

export default router;