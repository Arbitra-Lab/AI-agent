export enum LLMProviderErrorCode {
  RATE_LIMIT = 'RATE_LIMIT',
  TIMEOUT = 'TIMEOUT',
  AUTHENTICATION = 'AUTHENTICATION',
  INVALID_REQUEST = 'INVALID_REQUEST',
  SERVER_ERROR = 'SERVER_ERROR',
  UNKNOWN = 'UNKNOWN',
}

export class LLMProviderError extends Error {
  public code: LLMProviderErrorCode;
  public isRetryable: boolean;
  public provider: string;
  public details?: any;

  constructor(
    message: string,
    code: LLMProviderErrorCode,
    provider: string,
    isRetryable: boolean,
    details?: any,
  ) {
    super(message);
    this.name = 'LLMProviderError';
    this.code = code;
    this.provider = provider;
    this.isRetryable = isRetryable;
    this.details = details;
  }
}
