import { Result, ValidationError } from "express-validator";

/**
 * Custom Error class that includes a statusCode property.
 */
class HttpError extends Error {
  statusCode: number;

  constructor(message: string, status: number) {
    super(message);
    this.statusCode = status;
  }
}

/**
 * Throws a new HttpError with a custom message and status code.
 * This function never returns a value, hence the 'never' return type.
 */
export const throwCustomError = (message: string, status: number): never => {
  throw new HttpError(message, status);
};

/**
 * Adds a default status code of 500 to an error if it doesn't have one.
 * We define a type that can be any Error but might have a statusCode.
 */
export const addStatusCodeTo = (
  error: Error & { statusCode?: number }
): Error & { statusCode: number } => {
  if (!error.statusCode) {
    error.statusCode = 500;
  }
  return error as Error & { statusCode: number };
};

/**
 * Checks the result from express-validator.
 * Throws a 422 error if validation fails, otherwise returns true.
 */
export const hasNoValidationErrors = (
  errors: Result<ValidationError>
): boolean => {
  if (!errors.isEmpty()) {
    throw new HttpError("Validation failed!", 422);
  }
  return true;
};
