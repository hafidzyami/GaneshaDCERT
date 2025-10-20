import { body, query, param } from "express-validator";

/**
 * Schema Validators
 */

export const getAllVCSchemasValidator = [
  query("issuerDid")
    .optional()
    .trim()
    .matches(/^did:[a-z0-9]+:[a-zA-Z0-9._-]+$/)
    .withMessage("Invalid issuer DID format"),
];

export const createVCSchemaValidator = [
  body("id")
    .trim()
    .notEmpty()
    .withMessage("Schema ID is required"),

  body("name")
    .trim()
    .notEmpty()
    .withMessage("Schema name is required")
    .isLength({ min: 3, max: 255 })
    .withMessage("Schema name must be between 3 and 255 characters"),

  body("schema")
    .notEmpty()
    .withMessage("Schema object is required")
    .isObject()
    .withMessage("Schema must be a valid object"),

  body("issuer_did")
    .trim()
    .notEmpty()
    .withMessage("Issuer DID is required")
    .matches(/^did:[a-z0-9]+:[a-zA-Z0-9._-]+$/)
    .withMessage("Invalid issuer DID format"),

  body("version")
    .notEmpty()
    .withMessage("Version is required")
    .isInt({ min: 1 })
    .withMessage("Version must be a positive integer"),
];

export const updateVCSchemaValidator = [
  param("schemaId")
    .trim()
    .notEmpty()
    .withMessage("Schema ID is required"),

  body("name")
    .optional()
    .trim()
    .isLength({ min: 3, max: 255 })
    .withMessage("Schema name must be between 3 and 255 characters"),

  body("schema")
    .optional()
    .isObject()
    .withMessage("Schema must be a valid object"),

  body("issuer_did")
    .optional()
    .trim()
    .matches(/^did:[a-z0-9]+:[a-zA-Z0-9._-]+$/)
    .withMessage("Invalid issuer DID format"),

  body("version")
    .notEmpty()
    .withMessage("Version is required")
    .isInt({ min: 1 })
    .withMessage("Version must be a positive integer"),
];
