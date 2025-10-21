import { body, query, param } from "express-validator";
import { SCHEMA_CONSTANTS, SCHEMA_ERRORS } from "../constants/schema.constants";

/**
 * VC Schema Validators
 * 
 * PRINCIPLES:
 * - DRY: Reusable validation rules
 * - Clear error messages
 * - Type safety
 * - Consistent with constants
 */

// ============================================
// 🔹 REUSABLE VALIDATION RULES
// ============================================

const schemaIdValidation = param("id")
  .trim()
  .notEmpty()
  .withMessage(SCHEMA_ERRORS.VALIDATION.ID_REQUIRED)
  .isUUID()
  .withMessage(SCHEMA_ERRORS.VALIDATION.ID_INVALID_UUID);

const schemaNameValidation = (location: "body" | "query") => {
  const validator = location === "body" ? body("name") : query("name");
  return validator
    .trim()
    .notEmpty()
    .withMessage(SCHEMA_ERRORS.VALIDATION.NAME_REQUIRED)
    .isLength({
      min: SCHEMA_CONSTANTS.NAME_MIN_LENGTH,
      max: SCHEMA_CONSTANTS.NAME_MAX_LENGTH,
    })
    .withMessage(SCHEMA_ERRORS.VALIDATION.NAME_LENGTH);
};

const schemaObjectValidation = body("schema")
  .notEmpty()
  .withMessage(SCHEMA_ERRORS.VALIDATION.SCHEMA_REQUIRED)
  .isObject()
  .withMessage(SCHEMA_ERRORS.VALIDATION.SCHEMA_MUST_BE_OBJECT)
  .custom((value) => {
    if (!value.type) {
      throw new Error(SCHEMA_ERRORS.VALIDATION.SCHEMA_TYPE_REQUIRED);
    }
    if (value.type === "object" && !value.properties) {
      throw new Error(SCHEMA_ERRORS.VALIDATION.SCHEMA_PROPERTIES_REQUIRED);
    }
    return true;
  });

const issuerDidValidation = (location: "body" | "query") => {
  const validator = location === "body" ? body("issuer_did") : query("issuerDid");
  return validator
    .trim()
    .notEmpty()
    .withMessage(SCHEMA_ERRORS.VALIDATION.ISSUER_DID_REQUIRED)
    .matches(SCHEMA_CONSTANTS.DID_REGEX)
    .withMessage(SCHEMA_ERRORS.VALIDATION.ISSUER_DID_INVALID);
};

const issuerDidOptionalValidation = query("issuerDid")
  .optional()
  .trim()
  .matches(SCHEMA_CONSTANTS.DID_REGEX)
  .withMessage(SCHEMA_ERRORS.VALIDATION.ISSUER_DID_INVALID);

const activeOnlyValidation = query("activeOnly")
  .optional()
  .isBoolean()
  .withMessage(SCHEMA_ERRORS.QUERY.ACTIVE_ONLY_INVALID)
  .toBoolean();

// ============================================
// 🔹 QUERY PARAMETER VALIDATORS
// ============================================

/**
 * Validator for GET /schemas
 */
export const getAllVCSchemasValidator = [
  issuerDidOptionalValidation,
  activeOnlyValidation,
];

/**
 * Validator for GET /schemas/latest
 */
export const getLatestSchemaVersionValidator = [
  schemaNameValidation("query"),
  issuerDidValidation("query"),
];

/**
 * Validator for GET /schemas/versions
 */
export const getAllSchemaVersionsValidator = [
  schemaNameValidation("query"),
  issuerDidValidation("query"),
];

/**
 * Validator for GET /schemas/:id
 */
export const getSchemaByIdValidator = [schemaIdValidation];

/**
 * Validator for GET /schemas/:id/active
 */
export const isSchemaActiveValidator = [schemaIdValidation];

// ============================================
// 🔹 REQUEST BODY VALIDATORS
// ============================================

/**
 * Validator for POST /schemas
 */
export const createVCSchemaValidator = [
  schemaNameValidation("body"),
  schemaObjectValidation,
  issuerDidValidation("body"),
];

/**
 * Validator for PUT /schemas/:id
 */
export const updateVCSchemaValidator = [
  schemaIdValidation,
  schemaObjectValidation,
];

/**
 * Validator for PATCH /schemas/:id/deactivate
 */
export const deactivateVCSchemaValidator = [schemaIdValidation];

/**
 * Validator for PATCH /schemas/:id/reactivate
 */
export const reactivateVCSchemaValidator = [schemaIdValidation];

/**
 * Validator for DELETE /schemas/:id
 */
export const deleteVCSchemaValidator = [schemaIdValidation];
