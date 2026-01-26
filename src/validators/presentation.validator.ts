import { body, param } from "express-validator";

// DID format regex
const DID_REGEX = /^did:dcert:[iu](?:[a-zA-Z0-9_-]{44}|[a-zA-Z0-9_-]{87})$/;

// Valid predicate operators
const VALID_OPERATORS = [">", "<", ">=", "<=", "==", "!="];

/**
 * Presentation Validators
 */

// Helper function to check if mode is "full" (or not provided, since "full" is default)
const isFullMode = (value: any, { req }: any) => {
  const mode = req.body.mode;
  return mode === "full" || mode === undefined || mode === null || mode === "";
};

// Helper function to check if mode is "selective"
const isSelectiveMode = (value: any, { req }: any) => {
  return req.body.mode === "selective";
};

export const requestVPValidator = [
  // Mode is optional, defaults to "full" in controller
  body("mode")
    .optional()
    .trim()
    .isIn(["full", "selective"])
    .withMessage("mode must be 'full' or 'selective'"),

  body("holder_did")
    .trim()
    .notEmpty()
    .withMessage("Holder DID is required")
    .matches(DID_REGEX)
    .withMessage("Invalid holder DID format"),

  body("verifier_did")
    .trim()
    .notEmpty()
    .withMessage("Verifier DID is required")
    .matches(DID_REGEX)
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

  // Full mode fields (required when mode is "full" or not provided)
  body("requested_credentials")
    .if(isFullMode)
    .isArray({ min: 1 })
    .withMessage("requested_credentials must be a non-empty array for full mode"),

  body("requested_credentials.*.schema_id")
    .if(isFullMode)
    .optional()
    .trim()
    .notEmpty()
    .withMessage("schema_id is required for each requested credential")
    .isUUID()
    .withMessage("schema_id must be a valid UUID"),

  body("requested_credentials.*.schema_name")
    .if(isFullMode)
    .optional()
    .trim()
    .notEmpty()
    .withMessage("schema_name is required for each requested credential"),

  body("requested_credentials.*.schema_version")
    .if(isFullMode)
    .optional()
    .isInt({ min: 1 })
    .withMessage("schema_version must be a positive integer"),

  // Selective mode fields
  body("credential_types")
    .if(isSelectiveMode)
    .isArray({ min: 1 })
    .withMessage("credential_types must be a non-empty array for selective mode"),

  body("credential_types.*")
    .if(isSelectiveMode)
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Each credential type must be a non-empty string"),

  body("domain")
    .if(isSelectiveMode)
    .trim()
    .notEmpty()
    .withMessage("domain is required for selective mode"),

  body("expires_in")
    .optional()
    .isInt({ min: 60, max: 3600 })
    .withMessage("expires_in must be between 60 and 3600 seconds"),

  body("requested_attributes")
    .optional()
    .isArray()
    .withMessage("requested_attributes must be an array"),

  body("requested_attributes.*.attribute_path")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("attribute_path is required for each requested attribute"),

  body("requested_attributes.*.required")
    .optional()
    .isBoolean()
    .withMessage("required must be a boolean"),

  body("requested_attributes.*.accept_predicate")
    .optional()
    .isBoolean()
    .withMessage("accept_predicate must be a boolean"),

  body("requested_predicates")
    .optional()
    .isArray()
    .withMessage("requested_predicates must be an array"),

  body("requested_predicates.*.attribute_path")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("attribute_path is required for each predicate"),

  body("requested_predicates.*.operator")
    .optional()
    .isIn(VALID_OPERATORS)
    .withMessage(`operator must be one of: ${VALID_OPERATORS.join(", ")}`),

  body("requested_predicates.*.value")
    .optional()
    .custom((value) => {
      if (typeof value !== "string" && typeof value !== "number") {
        throw new Error("value must be a string or number");
      }
      return true;
    }),

  body("requested_predicates.*.required")
    .optional()
    .isBoolean()
    .withMessage("required must be a boolean"),
];

export const requestIdParamValidator = [
  param("id")
    .trim()
    .notEmpty()
    .withMessage("Request ID is required")
    .isUUID()
    .withMessage("Invalid request ID format"),
];

export const acceptRequestByIdValidator = [
  param("id")
    .trim()
    .notEmpty()
    .withMessage("Request ID is required")
    .isUUID()
    .withMessage("Invalid request ID format"),

  // Full mode fields (optional, presence depends on mode)
  body("vp_id")
    .optional()
    .isUUID()
    .withMessage("vp_id must be a valid UUID"),

  body("credentials")
    .optional()
    .isArray({ min: 1 })
    .withMessage("credentials must be a non-empty array"),

  body("credentials.*.schema_id")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("schema_id is required for each credential")
    .isUUID()
    .withMessage("schema_id must be a valid UUID"),

  body("credentials.*.schema_name")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("schema_name is required for each credential"),

  body("credentials.*.schema_version")
    .optional()
    .isInt({ min: 1 })
    .withMessage("schema_version must be a positive integer"),

  // Selective mode fields
  body("selective_vp")
    .optional()
    .isString()
    .withMessage("selective_vp must be a string")
    .custom((value) => {
      try {
        const vp = JSON.parse(value);
        if (!vp["@context"]) throw new Error("VP must have @context");
        if (!vp.type) throw new Error("VP must have type");
        if (!vp.holder) throw new Error("VP must have holder");
        if (!vp.verifiableCredential || !Array.isArray(vp.verifiableCredential)) {
          throw new Error("VP must have verifiableCredential array");
        }
        if (!vp.proof) throw new Error("VP must have proof");
        return true;
      } catch (error: any) {
        throw new Error(`Invalid selective_vp: ${error.message}`);
      }
    }),
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
