export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isRetryable: boolean;

  constructor(
    message: string,
    statusCode: number,
    code: string,
    isRetryable: boolean = false,
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isRetryable = isRetryable;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string = 'Validation failed') {
    super(message, 400, 'VALIDATION_ERROR', false);
  }
}

export class AuthError extends AppError {
  constructor(message: string = 'Authentication required') {
    super(message, 401, 'AUTH_ERROR', false);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Access denied') {
    super(message, 403, 'FORBIDDEN_ERROR', false);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found') {
    super(message, 404, 'NOT_FOUND_ERROR', false);
  }
}

export class ConflictError extends AppError {
  constructor(message: string = 'Resource conflict') {
    super(message, 409, 'CONFLICT_ERROR', false);
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = 'Too many requests') {
    super(message, 429, 'RATE_LIMIT_ERROR', true);
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(message: string = 'Service temporarily unavailable') {
    super(message, 503, 'SERVICE_UNAVAILABLE_ERROR', true);
  }
}

export class LLMProviderError extends AppError {
  constructor(message: string = 'LLM provider error') {
    super(message, 502, 'LLM_PROVIDER_ERROR', true);
  }
}

export class BlockchainError extends AppError {
  constructor(
    message: string = 'Blockchain error',
    isRetryable: boolean = false,
  ) {
    super(message, 502, 'BLOCKCHAIN_ERROR', isRetryable);
  }
}

export class InternalError extends AppError {
  constructor(message: string = 'Internal server error') {
    super(message, 500, 'INTERNAL_ERROR', false);
  }
}
