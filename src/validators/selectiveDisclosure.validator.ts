import { body, param, query } from "express-validator";

/**
 * Selective Disclosure Validators
 * Validates ZKP-based selective disclosure requests and VP submissions
 */

// DID format regex for dcert DIDs
const DID_REGEX = /^did:dcert:[iu](?:[a-zA-Z0-9_-]{44}|[a-zA-Z0-9_-]{87})$/;

// Valid predicate operators
const VALID_OPERATORS = [">", "<", ">=", "<=", "==", "!="];

/**
 * Validate selective disclosure request creation
 */
export const createSelectiveDisclosureRequestValidator = [
  body("holderDID")
    .trim()
    .notEmpty()
    .withMessage("Holder DID is required")
    .matches(DID_REGEX)
    .withMessage("Invalid holder DID format"),

  body("verifierDID")
    .trim()
    .notEmpty()
    .withMessage("Verifier DID is required")
    .matches(DID_REGEX)
    .withMessage("Invalid verifier DID format"),

  body("verifierName")
    .trim()
    .notEmpty()
    .withMessage("Verifier name is required")
    .isLength({ min: 1, max: 255 })
    .withMessage("Verifier name must be between 1 and 255 characters"),

  body("credentialTypes")
    .isArray({ min: 1 })
    .withMessage("credentialTypes must be a non-empty array"),

  body("credentialTypes.*")
    .trim()
    .notEmpty()
    .withMessage("Each credential type must be a non-empty string"),

  body("purpose")
    .trim()
    .notEmpty()
    .withMessage("Purpose is required")
    .isLength({ min: 1, max: 500 })
    .withMessage("Purpose must be between 1 and 500 characters"),

  body("domain")
    .trim()
    .notEmpty()
    .withMessage("Domain is required")
    .isLength({ min: 1, max: 255 })
    .withMessage("Domain must be between 1 and 255 characters"),

  body("expiresIn")
    .optional()
    .isInt({ min: 60, max: 3600 })
    .withMessage("expiresIn must be between 60 and 3600 seconds"),

  // Optional requested attributes
  body("requestedAttributes")
    .optional()
    .isArray()
    .withMessage("requestedAttributes must be an array"),

  body("requestedAttributes.*.attributePath")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("attributePath is required for each requested attribute"),

  body("requestedAttributes.*.required")
    .optional()
    .isBoolean()
    .withMessage("required must be a boolean"),

  body("requestedAttributes.*.acceptPredicate")
    .optional()
    .isBoolean()
    .withMessage("acceptPredicate must be a boolean"),

  // Optional requested predicates
  body("requestedPredicates")
    .optional()
    .isArray()
    .withMessage("requestedPredicates must be an array"),

  body("requestedPredicates.*.attributePath")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("attributePath is required for each predicate"),

  body("requestedPredicates.*.operator")
    .optional()
    .isIn(VALID_OPERATORS)
    .withMessage(`operator must be one of: ${VALID_OPERATORS.join(", ")}`),

  body("requestedPredicates.*.value")
    .optional()
    .custom((value) => {
      if (typeof value !== "string" && typeof value !== "number") {
        throw new Error("value must be a string or number");
      }
      return true;
    }),

  body("requestedPredicates.*.required")
    .optional()
    .isBoolean()
    .withMessage("required must be a boolean"),
];

/**
 * Validate get selective disclosure request by ID
 */
export const getSelectiveDisclosureRequestValidator = [
  param("requestId")
    .trim()
    .notEmpty()
    .withMessage("Request ID is required")
    .isUUID()
    .withMessage("Invalid request ID format"),
];

/**
 * Validate get pending requests for holder
 */
export const getPendingRequestsValidator = [
  query("holder_did")
    .optional()
    .trim()
    .matches(DID_REGEX)
    .withMessage("Invalid holder DID format"),
];

/**
 * Validate selective disclosure VP submission
 */
export const submitSelectiveDisclosureVPValidator = [
  body("requestId")
    .trim()
    .notEmpty()
    .withMessage("Request ID is required")
    .isUUID()
    .withMessage("Invalid request ID format"),

  body("selectiveVP")
    .notEmpty()
    .withMessage("selectiveVP is required")
    .isString()
    .withMessage("selectiveVP must be a string")
    .custom((value) => {
      try {
        const vp = JSON.parse(value);

        // Validate VP structure
        if (!vp["@context"]) {
          throw new Error("VP must have @context");
        }
        if (!vp.type) {
          throw new Error("VP must have type");
        }
        if (!vp.holder) {
          throw new Error("VP must have holder");
        }
        if (!vp.verifiableCredential || !Array.isArray(vp.verifiableCredential)) {
          throw new Error("VP must have verifiableCredential array");
        }
        if (!vp.proof) {
          throw new Error("VP must have proof");
        }

        // Validate proof structure
        if (!vp.proof.type) {
          throw new Error("VP proof must have type");
        }
        if (!vp.proof.challenge) {
          throw new Error("VP proof must have challenge");
        }
        if (!vp.proof.domain) {
          throw new Error("VP proof must have domain");
        }
        if (!vp.proof.proofValue) {
          throw new Error("VP proof must have proofValue");
        }

        return true;
      } catch (error: any) {
        throw new Error(`Invalid selectiveVP: ${error.message}`);
      }
    }),
];

/**
 * Validate get VP verification result
 */
export const getVerificationResultValidator = [
  param("vpId")
    .trim()
    .notEmpty()
    .withMessage("VP ID is required")
    .isUUID()
    .withMessage("Invalid VP ID format"),
];

/**
 * Validate decline selective disclosure request
 */
export const declineSelectiveDisclosureRequestValidator = [
  param("requestId")
    .trim()
    .notEmpty()
    .withMessage("Request ID is required")
    .isUUID()
    .withMessage("Invalid request ID format"),
];
