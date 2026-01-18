// Custom error classes
export class GCMError extends Error {
  public readonly code: string;
  public readonly cause?: Error;

  constructor(message: string, code: string, cause?: Error) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.cause = cause;
    Error.captureStackTrace(this, this.constructor);
  }
}

// Config errors
export class ConfigError extends GCMError {
  constructor(message: string, cause?: Error) {
    super(message, 'CONFIG_ERROR', cause);
  }
}

// Git errors
export class GitError extends GCMError {
  constructor(message: string, cause?: Error) {
    super(message, 'GIT_ERROR', cause);
  }
}

// API errors
export class APIError extends GCMError {
  constructor(message: string, code: string = 'API_ERROR', cause?: Error) {
    super(message, code, cause);
  }
}

// Validation errors
export class ValidationError extends GCMError {
  public readonly field?: string;

  constructor(message: string, field?: string) {
    super(message, 'VALIDATION_ERROR');
    this.field = field;
  }
}
