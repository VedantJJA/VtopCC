import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import authRouter from './routes/auth.routes';
import dataRouter from './routes/data.routes';

dotenv.config();

const app = express();

app.use(cors({
  origin: true, // Allow requests from all origins (or we can lock to frontend port later)
  credentials: true // Crucial for receiving HttpOnly cookies
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Health Check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// Routes
app.use('/api/auth', authRouter);
app.use('/api/data', dataRouter);

// Error handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Error Middleware]', err);
  res.status(err.status || 500).json({
    status: 'error',
    message: err.message || 'Internal Server Error'
  });
});

export default app;
