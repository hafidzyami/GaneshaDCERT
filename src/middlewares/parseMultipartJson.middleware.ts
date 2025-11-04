import { Request, Response, NextFunction } from "express";
import logger from "../config/logger";

/**
 * Recursively parse any string that looks like JSON in an object
 */
function deepParseJson(obj: any): any {
  if (typeof obj === "string") {
    // Try to parse string as JSON
    try {
      const parsed = JSON.parse(obj);
      // Recursively parse the result in case it contains more JSON strings
      return deepParseJson(parsed);
    } catch {
      // If not valid JSON, return as-is
      return obj;
    }
  } else if (Array.isArray(obj)) {
    // Parse each array element
    return obj.map((item) => deepParseJson(item));
  } else if (obj !== null && typeof obj === "object") {
    // Parse each object property
    const result: any = {};
    for (const key in obj) {
      // Use Object.prototype.hasOwnProperty.call for safety
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        result[key] = deepParseJson(obj[key]);
      }
    }
    return result;
  }
  // Return primitive values as-is
  return obj;
}

/**
 * Middleware to parse JSON string fields from multipart/form-data
 * Converts string representations of JSON to actual JSON objects
 * This is needed because multipart/form-data sends all fields as strings
 * Performs deep parsing to handle nested JSON strings
 */
export const parseSchemaJson = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Check if schema field exists
  if (req.body && req.body.schema) {
    try {
      // Deep parse the schema to handle nested JSON strings
      req.body.schema = deepParseJson(req.body.schema);

      // Remove expired_in from schema if it exists (it shouldn't be in schema object)
      if (req.body.schema && typeof req.body.schema === "object" && "expired_in" in req.body.schema) {
        delete req.body.schema.expired_in;
        logger.debug("Removed expired_in from schema object (it should be a top-level field)");
      }

      logger.debug("Schema field parsed (deep parse applied)", {
        schema: req.body.schema,
      });
    } catch (error) {
      // If parsing fails, log but continue - validator will catch it
      logger.warn("Failed to parse schema field", {
        schema: req.body.schema,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  next();
};
