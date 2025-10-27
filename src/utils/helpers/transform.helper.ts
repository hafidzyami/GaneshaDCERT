import { ValidationError as ExpressValidatorError } from "express-validator";

/**
 * Transform Helper
 * Data transformation utilities
 */

export class TransformHelper {
  /**
   * Transform express-validator errors to readable format
   */
  static transformValidationErrors(errors: ExpressValidatorError[]): any[] {
    return errors.map((error) => {
      if (error.type === "field") {
        const fieldError = error as any;
        return {
          type: error.type,
          field: fieldError.path,
          value: fieldError.value,
          message: error.msg,
          location: fieldError.location || "body",
        };
      }
      return {
        type: error.type,
        message: error.msg,
      };
    });
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
