import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { env } from './config/env';
import { config } from './config';
import routes from './routes';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { attachRequestId } from './middleware/requestId';
import { logger } from './utils/logger';
import { jobStore } from './services/import/jobStore';

const app = express();

app.use(helmet());
app.use(cors({
  origin: env.FRONTEND_URL,
  credentials: true,
}));
app.use(express.json({ limit: '50mb' }));
app.use(attachRequestId);

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT',
      message: 'Too many requests, please try again later',
    },
  },
});
app.use('/api', limiter);

app.use(routes);
app.use(notFoundHandler);
app.use(errorHandler);

// Start job cleanup interval
jobStore.startCleanup();

const server = app.listen(env.PORT, () => {
  logger.info('API server started', {
    port: env.PORT,
    env: env.NODE_ENV,
    frontendUrl: env.FRONTEND_URL,
    ...(env.NODE_ENV === 'development' ? { geminiModel: config.gemini.model } : {}),
  });
});

process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down');
  jobStore.stopCleanup();
  server.close();
});

export default app;
