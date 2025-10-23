import { Router } from 'express';
import healthRoutes from './health.ts';
import agentRoutes from './agent.ts';

const router = Router();

// health check route (still simple)
router.use('/health', healthRoutes);
router.use('/agent', agentRoutes);

export default router;
