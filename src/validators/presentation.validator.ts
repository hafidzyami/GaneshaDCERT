import { body, param } from "express-validator";

/**
 * Presentation Validators
 */

export const requestVPValidator = [
  body("holder_did")
    .trim()
    .notEmpty()
    .withMessage("Holder DID is required")
    .matches(/^did:dcert:[iu][a-zA-Z0-9_-]{44}$/)
    .withMessage("Invalid holder DID format"),

  body("verifier_did")
    .trim()
    .notEmpty()
    .withMessage("Verifier DID is required")
    .matches(/^did:dcert:[iu][a-zA-Z0-9_-]{44}$/)
    .withMessage("Invalid verifier DID format"),

  body("list_schema_id")
    .isArray({ min: 1 })
    .withMessage("list_schema_id must be a non-empty array"),

  body("list_schema_id.*")
    .trim()
    .notEmpty()
    .withMessage("Each schema ID must not be empty"),
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
  body("holder_did")
    .trim()
    .notEmpty()
    .withMessage("Holder DID is required")
    .matches(/^did:dcert:[iu][a-zA-Z0-9_-]{44}$/)
    .withMessage("Invalid holder DID format"),

  body("vp")
    .notEmpty()
    .withMessage("VP is required")
    .isObject()
    .withMessage("VP must be an object"),
];

export const getVPValidator = [
  param("vpId")
    .trim()
    .notEmpty()
    .withMessage("VP ID is required")
    .isUUID()
    .withMessage("Invalid VP ID format"),
];
