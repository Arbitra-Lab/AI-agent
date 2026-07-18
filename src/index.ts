import express from 'express';
import { errorHandler } from './middleware/error-handler';

const app = express();

app.use(express.json());

// Add a simple request ID middleware
app.use((req, res, next) => {
  (req as any).id = Math.random().toString(36).substring(7);
  next();
});

// Terminal Error Middleware
app.use(errorHandler);

// Unhandled Promise Rejections and Uncaught Exceptions
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception thrown:', error);
  process.exit(1);
});

export default app;
