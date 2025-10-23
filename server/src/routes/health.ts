import { Router } from 'express';

const router = Router();

// Fingerprint endpoint - returns data for a specific fingerprint ID
router.get('/', (req, res) => {
    console.log(req);
    res.json({ status: 'ok', message: 'UIA Server is running' });
});

export default router;
