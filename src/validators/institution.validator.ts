import { body, param, query } from "express-validator";

/**
 * Institution Validators
 * Validates institution-related requests
 */

/**
 * Validator for getting all institutions with query parameters
 */
export const getAllInstitutionsValidator = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),

  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100"),

  query("search")
    .optional()
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage("Search query must be between 1 and 255 characters"),

  query("country")
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("Country must be between 2 and 100 characters"),

  query("sortBy")
    .optional()
    .isIn(["name", "createdAt", "updatedAt"])
    .withMessage("sortBy must be one of: name, createdAt, updatedAt"),

  query("sortOrder")
    .optional()
    .isIn(["asc", "desc"])
    .withMessage("sortOrder must be either 'asc' or 'desc'"),
];

/**
 * Validator for getting institution by DID
 */
export const getInstitutionByDIDValidator = [
  param("did")
    .trim()
    .notEmpty()
    .withMessage("DID is required")
    .matches(/^did:dcert:[iu][a-zA-Z0-9_-]{44}$/)
    .withMessage("Invalid DID format"),
];

/**
 * Validator for updating institution by DID
 */
export const updateInstitutionValidator = [
  param("did")
    .trim()
    .notEmpty()
    .withMessage("DID is required")
    .matches(/^did:dcert:[iu][a-zA-Z0-9_-]{44}$/)
    .withMessage("Invalid DID format"),

  body("name")
    .optional()
    .trim()
    .isLength({ min: 2, max: 255 })
    .withMessage("Name must be between 2 and 255 characters"),

  body("phone")
    .optional()
    .trim()
    .matches(/^\+?[1-9]\d{1,14}$/)
    .withMessage("Must be a valid phone number in E.164 format"),

  body("country")
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("Country must be between 2 and 100 characters"),

  body("website")
    .optional()
    .trim()
    .isURL()
    .withMessage("Must be a valid URL"),

  body("address")
    .optional()
    .trim()
    .isLength({ min: 5, max: 500 })
    .withMessage("Address must be between 5 and 500 characters"),
];

/**
 * Validator for deleting institution by DID
 */
export const deleteInstitutionValidator = [
  param("did")
    .trim()
    .notEmpty()
    .withMessage("DID is required")
    .matches(/^did:dcert:[iu][a-zA-Z0-9_-]{44}$/)
    .withMessage("Invalid DID format"),
];
