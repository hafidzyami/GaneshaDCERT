import { Response } from 'express';
import { ApiResponse, PaginationMeta } from '../../types';

/**
 * Response Helper
 * Standardized API response formats with proper HTTP status codes
 *
 * PATTERN:
 * - Success responses: HTTP 200 with success: true
 * - Created responses: HTTP 201 with success: true
 * - Error responses: Proper HTTP status (400, 401, 404, 500, etc.) with success: false
 * - GET not found: HTTP 200 with success: true, found: false, data: null
 */

export class ResponseHelper {
  /**
   * Send success response (success: true)
   * Returns HTTP 200
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
   * Returns HTTP 200
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
   * Returns HTTP 201
   */
  static created<T>(
    res: Response,
    data: T,
    message: string = 'Resource created successfully'
  ): Response {
    const response: ApiResponse<T> = {
      success: true,
      message,
      data,
    };

    return res.status(201).json(response);
  }

  /**
   * Send GET not found response (for GET requests only)
   * Returns HTTP 200 with found: false
   * Use this when a GET request doesn't find a resource
   */
  static getNotFound(
    res: Response,
    message: string = 'Resource not found'
  ): Response {
    const response: any = {
      success: true,
      found: false,
      message,
      data: null,
    };

    return res.status(200).json(response);
  }

  /**
   * Send error response (success: false)
   * Returns specified HTTP status code
   *
   * @param res - Express Response object
   * @param statusCode - HTTP status code (400, 401, 404, 500, etc.)
   * @param message - Error message
   * @param errors - Optional validation errors array
   * @param data - Optional additional data
   */
  static error(
    res: Response,
    statusCode: number,
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

    return res.status(statusCode).json(response);
  }

  /**
   * Send not found response (success: false)
   * Returns HTTP 404
   */
  static notFound(
    res: Response,
    message: string = 'Resource not found',
    data?: any
  ): Response {
    return ResponseHelper.error(res, 404, message, undefined, data);
  }

  /**
   * Send validation error response (success: false)
   * Returns HTTP 422
   */
  static validationError(
    res: Response,
    message: string = 'Validation failed',
    errors: any[]
  ): Response {
    return ResponseHelper.error(res, 422, message, errors);
  }

  /**
   * Send bad request response (success: false)
   * Returns HTTP 400
   */
  static badRequest(
    res: Response,
    message: string = 'Bad request',
    data?: any
  ): Response {
    return ResponseHelper.error(res, 400, message, undefined, data);
  }

  /**
   * Send unauthorized response (success: false)
   * Returns HTTP 401
   */
  static unauthorized(
    res: Response,
    message: string = 'Unauthorized'
  ): Response {
    return ResponseHelper.error(res, 401, message);
  }

  /**
   * Send forbidden response (success: false)
   * Returns HTTP 403
   */
  static forbidden(
    res: Response,
    message: string = 'Forbidden'
  ): Response {
    return ResponseHelper.error(res, 403, message);
  }

  /**
   * Send conflict response (success: false)
   * Returns HTTP 409
   */
  static conflict(
    res: Response,
    message: string = 'Resource conflict',
    data?: any
  ): Response {
    return ResponseHelper.error(res, 409, message, undefined, data);
  }

  /**
   * Send internal server error response (success: false)
   * Returns HTTP 500
   */
  static internalError(
    res: Response,
    message: string = 'Internal server error'
  ): Response {
    return ResponseHelper.error(res, 500, message);
  }
}
