import { Response } from 'express';
import { ApiResponse, PaginationMeta } from '../../types';
import { HTTP_STATUS } from '../../constants';

/**
 * Response Helper
 * Standardized API response formats
 */

export class ResponseHelper {
  /**
   * Send success response
   */
  static success<T>(
    res: Response,
    data: T,
    message?: string,
    statusCode: number = HTTP_STATUS.OK
  ): Response {
    const response: ApiResponse<T> = {
      success: true,
      ...(message && { message }),
      data,
    };

    return res.status(statusCode).json(response);
  }

  /**
   * Send success response with pagination
   */
  static successWithPagination<T>(
    res: Response,
    data: T,
    pagination: PaginationMeta,
    message?: string,
    statusCode: number = HTTP_STATUS.OK
  ): Response {
    const response: ApiResponse<T> = {
      success: true,
      ...(message && { message }),
      data,
      pagination,
    };

    return res.status(statusCode).json(response);
  }

  /**
   * Send created response
   */
  static created<T>(res: Response, data: T, message: string = 'Resource created successfully'): Response {
    return ResponseHelper.success(res, data, message, HTTP_STATUS.CREATED);
  }

  /**
   * Send error response
   */
  static error(
    res: Response,
    message: string,
    statusCode: number = HTTP_STATUS.INTERNAL_SERVER_ERROR,
    errors?: any[]
  ): Response {
    const response: ApiResponse = {
      success: false,
      message,
      ...(errors && { errors }),
    };

    return res.status(statusCode).json(response);
  }

  /**
   * Send no content response
   */
  static noContent(res: Response): Response {
    return res.status(HTTP_STATUS.NO_CONTENT).send();
  }
}
