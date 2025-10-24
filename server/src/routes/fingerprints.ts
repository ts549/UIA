import { Router } from 'express';
import type { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { removeFingerprints } from '../utils/fingerprints/removeFingerprints.ts';
import { addFingerprints } from '../utils/fingerprints/addFingerprints.ts';
import { buildGraph } from '../utils/graph/buildGraph.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = Router();

// POST endpoint - removes and re-adds fingerprints, then rebuilds the graph
router.post('/refresh', async (_req: Request, res: Response) => {
  try {
    // Get the frontend path
    const frontendPath = path.resolve(__dirname, '../../../my-app');
    const attributeName = 'data-fingerprint';

    console.log('\n=== Refreshing Fingerprints ===');
    
    // First, remove existing fingerprints
    console.log('Removing existing fingerprints...');
    const removeResults = await removeFingerprints(frontendPath, { attributeName });
    console.log(`✓ Removed ${removeResults.totalFingerprintsRemoved} fingerprints`);

    // Then, add fingerprints back
    console.log('Adding fingerprints...');
    const addResults = await addFingerprints(frontendPath, { attributeName });
    console.log(`✓ Added ${addResults.totalFingerprintsAdded} fingerprints`);

    // Rebuild the graph
    console.log('Rebuilding graph...');
    const srcDir = path.join(frontendPath, 'src');
    buildGraph(srcDir);
    console.log('✓ Graph rebuilt successfully');

    res.json({
      success: true,
      removed: removeResults.totalFingerprintsRemoved,
      added: addResults.totalFingerprintsAdded,
      message: 'Fingerprints refreshed and graph rebuilt successfully'
    });
  } catch (error) {
    console.error('Error refreshing fingerprints:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

export default router;