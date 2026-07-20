import { Request, Response, NextFunction } from 'express';
import { AppError } from '../lib/errors';

// Assuming request has an ID, if not, we fallback
interface RequestWithId extends Request {
  id?: string;
}

export const errorHandler = (
  err: Error,
  req: RequestWithId,
  res: Response,
  next: NextFunction
) => {
  const requestId = req.id || 'unknown';

  if (err instanceof AppError) {
    const errorResponse: any = {
      error: {
        code: err.code,
        message: err.message,
        requestId,
      },
    };

    if (process.env.NODE_ENV !== 'production') {
      errorResponse.error.stack = err.stack;
    }

    console.error(`[${requestId}] ${err.code}: ${err.message}`, err);

    return res.status(err.statusCode).json(errorResponse);
  }

  // Unhandled/Non-AppError throws
  console.error(`[${requestId}] UNHANDLED_ERROR:`, err);

  const errorResponse: any = {
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
      requestId,
    },
  };

  if (process.env.NODE_ENV !== 'production') {
    errorResponse.error.stack = err.stack;
    errorResponse.error.details = err.message;
  }

  return res.status(500).json(errorResponse);
};
