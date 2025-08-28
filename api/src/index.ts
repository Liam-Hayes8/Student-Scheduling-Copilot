import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

import { errorHandler, notFound } from '@/middleware/error';
import { requestLogger } from '@/middleware/logging';
import authRoutes from '@/routes/auth';
import plannerRoutes from '@/routes/planner';
import calendarRoutes from '@/routes/calendar';
import syllabusRoutes from '@/routes/syllabus';


const app = express();
const PORT = process.env.PORT || 8080;

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});

app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3004',
  credentials: true
}));
app.use(limiter);
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);

app.use('/api/auth', authRoutes);
app.use('/api/planner', plannerRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/syllabus', syllabusRoutes);

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

app.use(notFound);
app.use(errorHandler);

// Only start the server when not under test or when run directly
if (process.env.NODE_ENV !== 'test' && require.main === module) {
  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
  });
}

export default app;