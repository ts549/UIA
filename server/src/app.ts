import express from 'express';
import cors from 'cors';
import routes from './routes/router.ts';

const app = express();

// ===== Middleware =====
app.use(cors());
app.use(express.json());

// ===== Routes =====
app.use('/api', routes);

export default app;
