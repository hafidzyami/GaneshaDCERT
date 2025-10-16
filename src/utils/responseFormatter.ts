/**
 * Response Formatter
 * Standardizes API responses across the application
 */

export interface SuccessResponse<T = any> {
  success: true;
  message: string;
  data?: T;
  timestamp: string;
}

export interface ErrorResponse {
  success: false;
  message: string;
  error?: string;
  details?: any;
  timestamp: string;
}

/**
 * Formats a success response
 */
export function formatSuccessResponse<T = any>(
  message: string,
  data?: T
): SuccessResponse<T> {
  return {
    success: true,
    message,
    ...(data && { data }),
    timestamp: new Date().toISOString(),
  };
}

/**
 * Formats an error response
 */
export function formatErrorResponse(
  message: string,
  error?: string,
  details?: any
): ErrorResponse {
  return {
    success: false,
    message,
    ...(error && { error }),
    ...(details && { details }),
    timestamp: new Date().toISOString(),
  };
}

/**
 * Formats validation error response from express-validator
 */
export function formatValidationErrorResponse(errors: any[]): ErrorResponse {
  return {
    success: false,
    message: "Validation failed",
    error: "Invalid input data",
    details: errors.map((err) => ({
      field: err.path || err.param,
      message: err.msg,
      value: err.value,
    })),
    timestamp: new Date().toISOString(),
  };
}
