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
  _next: NextFunction,
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

  // Some library errors (e.g. body-parser's PayloadTooLargeError) carry a
  // meaningful HTTP status without being an AppError. Respect it when
  // present rather than flattening every non-AppError to 500.
  const libraryStatus =
    (err as Error & { status?: number; statusCode?: number }).status ??
    (err as Error & { statusCode?: number }).statusCode;
  const statusCode =
    typeof libraryStatus === 'number' &&
    libraryStatus >= 400 &&
    libraryStatus < 600
      ? libraryStatus
      : 500;

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

  return res.status(statusCode).json(errorResponse);
};
