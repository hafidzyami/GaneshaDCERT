import { Response } from 'express';
import { ApiResponse, PaginationMeta } from '../../types';

/**
 * Response Helper
 * Standardized API response formats
 * 
 * NEW PATTERN: All responses return HTTP 200 with success flag
 * - success: true  → Operation successful
 * - success: false → Operation failed (validation, not found, etc.)
 */

export class ResponseHelper {
  /**
   * Send success response (success: true)
   * Always returns HTTP 200
   */
  static success<T>(
    res: Response,
    data: T,
    message?: string
  ): Response {
    const response: ApiResponse<T> = {
      success: true,
      ...(message && { message }),
      data,
    };

    return res.status(200).json(response);
  }

  /**
   * Send success response with pagination
   * Always returns HTTP 200
   */
  static successWithPagination<T>(
    res: Response,
    data: T,
    pagination: PaginationMeta,
    message?: string
  ): Response {
    const response: ApiResponse<T> = {
      success: true,
      ...(message && { message }),
      data,
      pagination,
    };

    return res.status(200).json(response);
  }

  /**
   * Send created response (success: true)
   * Always returns HTTP 200 (not 201)
   */
  static created<T>(
    res: Response, 
    data: T, 
    message: string = 'Resource created successfully'
  ): Response {
    return ResponseHelper.success(res, data, message);
  }

  /**
   * Send error response (success: false)
   * Always returns HTTP 200 (not 4xx or 5xx)
   * 
   * @param res - Express Response object
   * @param message - Error message
   * @param errors - Optional validation errors array
   * @param data - Optional additional data
   */
  static error(
    res: Response,
    message: string,
    errors?: any[],
    data?: any
  ): Response {
    const response: ApiResponse = {
      success: false,
      message,
      ...(errors && errors.length > 0 && { errors }),
      ...(data && { data }),
    };

    return res.status(200).json(response);
  }

  /**
   * Send not found response (success: false)
   * Always returns HTTP 200
   */
  static notFound(
    res: Response,
    message: string = 'Resource not found',
    data?: any
  ): Response {
    return ResponseHelper.error(res, message, undefined, data);
  }

  /**
   * Send validation error response (success: false)
   * Always returns HTTP 200
   */
  static validationError(
    res: Response,
    message: string = 'Validation failed',
    errors: any[]
  ): Response {
    return ResponseHelper.error(res, message, errors);
  }

  /**
   * Send bad request response (success: false)
   * Always returns HTTP 200
   */
  static badRequest(
    res: Response,
    message: string = 'Bad request',
    data?: any
  ): Response {
    return ResponseHelper.error(res, message, undefined, data);
  }

  /**
   * Send unauthorized response (success: false)
   * Always returns HTTP 200
   */
  static unauthorized(
    res: Response,
    message: string = 'Unauthorized'
  ): Response {
    return ResponseHelper.error(res, message);
  }

  /**
   * Send forbidden response (success: false)
   * Always returns HTTP 200
   */
  static forbidden(
    res: Response,
    message: string = 'Forbidden'
  ): Response {
    return ResponseHelper.error(res, message);
  }

  /**
   * Send conflict response (success: false)
   * Always returns HTTP 200
   */
  static conflict(
    res: Response,
    message: string = 'Resource conflict',
    data?: any
  ): Response {
    return ResponseHelper.error(res, message, undefined, data);
  }

  /**
   * Send internal server error response (success: false)
   * Always returns HTTP 200
   */
  static internalError(
    res: Response,
    message: string = 'Internal server error'
  ): Response {
    return ResponseHelper.error(res, message);
  }
}
