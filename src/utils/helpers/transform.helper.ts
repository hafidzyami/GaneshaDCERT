import { ValidationError as ExpressValidatorError } from 'express-validator';

/**
 * Transform Helper
 * Data transformation utilities
 */

export class TransformHelper {
  /**
   * Transform express-validator errors to readable format
   */
  static transformValidationErrors(errors: ExpressValidatorError[]): any[] {
    return errors.map((error) => ({
      field: error.type === 'field' ? (error as any).path : 'unknown',
      message: error.msg,
      value: error.type === 'field' ? (error as any).value : undefined,
    }));
  }

  /**
   * Calculate pagination metadata
   */
  static calculatePagination(total: number, page: number, limit: number) {
    return {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Remove sensitive fields from object
   */
  static removeSensitiveFields<T extends Record<string, any>>(
    obj: T,
    fields: (keyof T)[]
  ): Partial<T> {
    const result = { ...obj };
    fields.forEach((field) => {
      delete result[field];
    });
    return result;
  }

  /**
   * Sanitize object (remove null/undefined values)
   */
  static sanitize<T extends Record<string, any>>(obj: T): Partial<T> {
    const result: any = {};
    Object.keys(obj).forEach((key) => {
      if (obj[key] !== null && obj[key] !== undefined) {
        result[key] = obj[key];
      }
    });
    return result;
  }
}
