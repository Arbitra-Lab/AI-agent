import { 
  ValidationError, AuthError, ForbiddenError, NotFoundError, 
  ConflictError, RateLimitError, LLMProviderError, 
  BlockchainError, InternalError 
} from '../src/lib/errors';
import { errorHandler } from '../src/middleware/error-handler';
import { Request, Response, NextFunction } from 'express';

describe('App Errors', () => {
  it('ValidationError should have status 400', () => {
    const err = new ValidationError();
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.isRetryable).toBe(false);
  });

  it('AuthError should have status 401', () => {
    const err = new AuthError();
    expect(err.statusCode).toBe(401);
  });

  it('RateLimitError should be retryable', () => {
    const err = new RateLimitError();
    expect(err.statusCode).toBe(429);
    expect(err.isRetryable).toBe(true);
  });

  it('BlockchainError should allow setting retryable', () => {
    const err = new BlockchainError('test', true);
    expect(err.isRetryable).toBe(true);
  });
});

describe('Error Handler Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockRequest = { id: 'test-req-id' } as any;
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    mockNext = jest.fn();
    
    // Silence console.error for tests
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should format AppError correctly', () => {
    const err = new NotFoundError('User not found');
    
    // Simulate production environment
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    
    errorHandler(err, mockRequest as Request, mockResponse as Response, mockNext);
    
    expect(mockResponse.status).toHaveBeenCalledWith(404);
    expect(mockResponse.json).toHaveBeenCalledWith({
      error: {
        code: 'NOT_FOUND_ERROR',
        message: 'User not found',
        requestId: 'test-req-id',
      }
    });
    
    process.env.NODE_ENV = originalEnv;
  });

  it('should format generic error as 500 INTERNAL_ERROR', () => {
    const err = new Error('Some unexpected failure');
    
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    
    errorHandler(err, mockRequest as Request, mockResponse as Response, mockNext);
    
    expect(mockResponse.status).toHaveBeenCalledWith(500);
    expect(mockResponse.json).toHaveBeenCalledWith({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
        requestId: 'test-req-id',
      }
    });
    
    process.env.NODE_ENV = originalEnv;
  });

  it('should respect a library-provided status code for non-AppError errors', () => {
    const err = new Error('request entity too large') as Error & { status: number };
    err.status = 413;

    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    errorHandler(err, mockRequest as Request, mockResponse as Response, mockNext);

    expect(mockResponse.status).toHaveBeenCalledWith(413);
    expect(mockResponse.json).toHaveBeenCalledWith({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
        requestId: 'test-req-id',
      }
    });

    process.env.NODE_ENV = originalEnv;
  });

  it('should ignore an out-of-range status and fall back to 500', () => {
    const err = new Error('weird error') as Error & { status: number };
    err.status = 999;

    errorHandler(err, mockRequest as Request, mockResponse as Response, mockNext);

    expect(mockResponse.status).toHaveBeenCalledWith(500);
  });
});
