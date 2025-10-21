/**
 * Base Application Error
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    statusCode: number = 500,
    isOperational: boolean = true
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;

    Object.setPrototypeOf(this, AppError.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Bad Request Error (400)
 */
export class BadRequestError extends AppError {
  constructor(message: string = "Bad Request") {
    super(message, 400);
  }
}

/**
 * Unauthorized Error (401)
 */
export class UnauthorizedError extends AppError {
  constructor(message: string = "Unauthorized") {
    super(message, 401);
  }
}

/**
 * Forbidden Error (403)
 */
export class ForbiddenError extends AppError {
  constructor(message: string = "Forbidden") {
    super(message, 403);
  }
}

/**
 * Not Found Error (404)
 */
export class NotFoundError extends AppError {
  constructor(message: string = "Resource not found") {
    super(message, 404);
  }
}

/**
 * Conflict Error (409)
 */
export class ConflictError extends AppError {
  constructor(message: string = "Resource conflict") {
    super(message, 409);
  }
}

/**
 * Validation Error (422)
 */
export class ValidationError extends AppError {
  public readonly errors?: any[];

  constructor(message: string = "Validation failed", errors?: any[]) {
    super(message, 422);
    this.errors = errors;
  }
}

/**
 * Internal Server Error (500)
 */
export class InternalServerError extends AppError {
  constructor(message: string = "Internal server error") {
    super(message, 500);
  }
}

/**
 * Blockchain Transaction Error
 */
export class BlockchainError extends AppError {
  public readonly transactionHash?: string;

  constructor(
    message: string = "Blockchain transaction failed",
    transactionHash?: string
  ) {
    super(message, 500);
    this.transactionHash = transactionHash;
  }
}

/**
 * Database Error
 */
export class DatabaseError extends AppError {
  constructor(message: string = "Database operation failed") {
    super(message, 500);
  }
}
