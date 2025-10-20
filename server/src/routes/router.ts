import { Router } from 'express';
import sourceDataRoutes from './sourceData.ts';
import promptAgentRoutes from './promptAgent.ts';

const router = Router();

// health check route (still simple)
router.get('/health', (req, res) => {
  console.log(req);
  res.json({ status: 'ok', message: 'UIA Server is running' });
});

router.use('/sourceData', sourceDataRoutes);
router.use('/promptAgent', promptAgentRoutes);

export default router;
