import { Request, Response, NextFunction } from "express";
import { AppError, ValidationError } from "../utils";
import { env, logger } from "../config";
import { TransformHelper } from "../utils/helpers";

/**
 * Global Error Handler Middleware
 *
 * PATTERN:
 * - GET requests with NotFoundError: Return HTTP 200 with { success: true, found: false, data: null }
 * - All other errors: Return proper HTTP status code (400, 401, 404, 500, etc.) with { success: false }
 */
export const errorHandler = (
  error: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Default error message and status code
  let message = "Internal server error";
  let statusCode = 500;
  let errors: any[] | undefined;

  // Debug: Log error type and properties
  logger.debug("Error Handler Debug:", {
    errorName: error.name,
    errorMessage: error.message,
    isAppError: error instanceof AppError,
    isValidationError: error instanceof ValidationError,
    hasErrorsProperty: "errors" in error,
    errorProperties: Object.keys(error),
    method: req.method,
  });

  // Handle operational errors
  if (error instanceof AppError) {
    message = error.message;
    statusCode = error.statusCode;

    // Handle ValidationError specifically
    if (error instanceof ValidationError) {
      if (
        error.errors &&
        Array.isArray(error.errors) &&
        error.errors.length > 0
      ) {
        errors = TransformHelper.transformValidationErrors(error.errors);

        // Log validation errors for debugging
        logger.warn("Validation Error:", {
          message: error.message,
          errors: errors,
          url: req.originalUrl,
          method: req.method,
          body: req.body,
        });
      }
    } else {
      // Log other operational errors
      logger.warn("Operational Error:", {
        name: error.name,
        message: error.message,
        statusCode: error.statusCode,
        url: req.originalUrl,
        method: req.method,
      });
    }
  } else {
    // Log unexpected errors
    logger.error("Unexpected Error", {
      name: error.name,
      message: error.message,
      stack: error.stack,
      url: req.originalUrl,
      method: req.method,
      body: req.body,
      params: req.params,
      query: req.query,
      requestId: req.requestId,
    });

    // Don't expose internal error details in production
    if (env.NODE_ENV === "production") {
      message = "Something went wrong";
    } else {
      message = error.message;
    }
  }

  // SPECIAL HANDLING for GET requests with NotFoundError
  // Return 200 with found: false instead of 404 error
  if (req.method === "GET" && error instanceof AppError && statusCode === 404) {
    const responseObj: any = {
      success: true,
      found: false,
      message: message || "Resource not found",
      data: null,
    };

    // Add requestId if exists
    if (req.requestId) {
      responseObj.requestId = req.requestId;
    }

    logger.info("GET request - Resource not found (returning 200 with found: false):", {
      url: req.originalUrl,
      method: req.method,
    });

    res.status(200).json(responseObj);
  } else {
    // Build error response object
    const responseObj: any = {
      success: false,
      message,
    };

    // Add errors array if exists
    if (errors && errors.length > 0) {
      responseObj.errors = errors;
    }

    // Add requestId if exists
    if (req.requestId) {
      responseObj.requestId = req.requestId;
    }

    // Add stack trace in development
    if (env.NODE_ENV === "development") {
      responseObj.stack = error.stack;
      responseObj.name = error.name;
    }

    // Return response with proper HTTP status code
    res.status(statusCode).json(responseObj);
  }
};

/**
 * Handle 404 Not Found (for undefined routes)
 * Returns proper HTTP 404 status
 */
export const notFoundHandler = (req: Request, res: Response): void => {
  logger.warn(`Route not found: ${req.method} ${req.originalUrl}`);

  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found`,
    ...(req.requestId && { requestId: req.requestId }),
  });
};

/**
 * Async Handler Wrapper
 * Catches async errors and passes them to error handler
 */
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
