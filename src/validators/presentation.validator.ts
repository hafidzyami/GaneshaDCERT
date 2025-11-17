import { body, param } from "express-validator";

/**
 * Presentation Validators
 */

export const requestVPValidator = [
  body("holder_did")
    .trim()
    .notEmpty()
    .withMessage("Holder DID is required")
    .matches(/^did:dcert:[iu](?:[a-zA-Z0-9_-]{44}|[a-zA-Z0-9_-]{87})$/)
    .withMessage("Invalid holder DID format"),

  body("verifier_did")
    .trim()
    .notEmpty()
    .withMessage("Verifier DID is required")
    .matches(/^did:dcert:[iu](?:[a-zA-Z0-9_-]{44}|[a-zA-Z0-9_-]{87})$/)
    .withMessage("Invalid verifier DID format"),

  body("verifier_name")
    .trim()
    .notEmpty()
    .withMessage("Verifier name is required")
    .isLength({ min: 1, max: 255 })
    .withMessage("Verifier name must be between 1 and 255 characters"),

  body("purpose")
    .trim()
    .notEmpty()
    .withMessage("Purpose is required")
    .isLength({ min: 1, max: 500 })
    .withMessage("Purpose must be between 1 and 500 characters"),

  body("requested_credentials")
    .isArray({ min: 1 })
    .withMessage("requested_credentials must be a non-empty array"),

  body("requested_credentials.*.schema_id")
    .trim()
    .notEmpty()
    .withMessage("schema_id is required for each requested credential")
    .isUUID()
    .withMessage("schema_id must be a valid UUID"),

  body("requested_credentials.*.schema_name")
    .trim()
    .notEmpty()
    .withMessage("schema_name is required for each requested credential"),

  body("requested_credentials.*.schema_version")
    .isInt({ min: 1 })
    .withMessage("schema_version must be a positive integer"),
];

export const getVPRequestDetailsValidator = [
  param("vpReqId")
    .trim()
    .notEmpty()
    .withMessage("VP Request ID is required")
    .isUUID()
    .withMessage("Invalid VP Request ID format"),
];

export const storeVPValidator = [
  body("vp")
    .notEmpty()
    .withMessage("VP is required")
    .isString()
    .withMessage("VP must be a string")
    .custom((value) => {
      try {
        JSON.parse(value);
        return true;
      } catch (error) {
        throw new Error("VP must be a valid JSON string");
      }
    }),

  body("is_barcode")
    .optional()
    .isBoolean()
    .withMessage("is_barcode must be a boolean"),
];

export const getVPValidator = [
  param("vpId")
    .trim()
    .notEmpty()
    .withMessage("VP ID is required")
    .isUUID()
    .withMessage("Invalid VP ID format"),
];

export const verifyVPValidator = [
  param("vpId")
    .trim()
    .notEmpty()
    .withMessage("VP ID is required")
    .isUUID()
    .withMessage("Invalid VP ID format"),
];

export const acceptVPRequestValidator = [
  body("credentials")
    .isArray({ min: 1 })
    .withMessage("credentials must be a non-empty array"),

  body("credentials.*.schema_id")
    .trim()
    .notEmpty()
    .withMessage("schema_id is required for each credential")
    .isUUID()
    .withMessage("schema_id must be a valid UUID"),

  body("credentials.*.schema_name")
    .trim()
    .notEmpty()
    .withMessage("schema_name is required for each credential"),

  body("credentials.*.schema_version")
    .isInt({ min: 1 })
    .withMessage("schema_version must be a positive integer"),
];

export const confirmVPValidator = [
  body("verifier_did")
    .trim()
    .notEmpty()
    .withMessage("Verifier DID is required")
    .matches(/^did:dcert:[iu](?:[a-zA-Z0-9_-]{44}|[a-zA-Z0-9_-]{87})$/)
    .withMessage("Invalid verifier DID format"),

  body("vp_ids")
    .isArray({ min: 1 })
    .withMessage("vp_ids must be a non-empty array"),

  body("vp_ids.*")
    .trim()
    .notEmpty()
    .withMessage("Each vp_id is required")
    .isUUID()
    .withMessage("Each vp_id must be a valid UUID"),
];

export const deleteVPValidator = [
  param("vpId")
    .trim()
    .notEmpty()
    .withMessage("VP ID is required")
    .isUUID()
    .withMessage("Invalid VP ID format"),
];
