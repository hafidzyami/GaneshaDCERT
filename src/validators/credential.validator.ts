import { body, query, param } from "express-validator";
import { RequestType } from "@prisma/client";

/**
 * Credential Validators
 */

export const requestCredentialValidator = [
  body("encrypted_body")
    .trim()
    .notEmpty()
    .withMessage("Encrypted body is required"),

  body("issuer_did")
    .trim()
    .notEmpty()
    .withMessage("Issuer DID is required")
    .matches(/^did:[a-z0-9]+:[a-zA-Z0-9._-]+$/)
    .withMessage("Invalid issuer DID format"),

  body("holder_did")
    .trim()
    .notEmpty()
    .withMessage("Holder DID is required")
    .matches(/^did:[a-z0-9]+:[a-zA-Z0-9._-]+$/)
    .withMessage("Invalid holder DID format"),
];

export const getCredentialRequestsByTypeValidator = [
  query("type")
    .notEmpty()
    .withMessage("Request type is required")
    .isIn([RequestType.ISSUANCE, RequestType.RENEWAL, RequestType.UPDATE, RequestType.REVOKE])
    .withMessage("Invalid request type. Must be ISSUANCE, RENEWAL, UPDATE, or REVOKE"),

  query("issuer_did")
    .optional()
    .trim()
    .matches(/^did:[a-z0-9]+:[a-zA-Z0-9._-]+$/)
    .withMessage("Invalid issuer DID format"),
];

export const processCredentialResponseValidator = [
  body("request_id")
    .trim()
    .notEmpty()
    .withMessage("Request ID is required")
    .isUUID()
    .withMessage("Invalid request ID format"),

  body("issuer_did")
    .trim()
    .notEmpty()
    .withMessage("Issuer DID is required")
    .matches(/^did:[a-z0-9]+:[a-zA-Z0-9._-]+$/)
    .withMessage("Invalid issuer DID format"),

  body("holder_did")
    .trim()
    .notEmpty()
    .withMessage("Holder DID is required")
    .matches(/^did:[a-z0-9]+:[a-zA-Z0-9._-]+$/)
    .withMessage("Invalid holder DID format"),

  body("encrypted_body")
    .trim()
    .notEmpty()
    .withMessage("Encrypted body is required"),

  body("request_type")
    .notEmpty()
    .withMessage("Request type is required")
    .isIn([RequestType.ISSUANCE, RequestType.RENEWAL, RequestType.UPDATE, RequestType.REVOKE])
    .withMessage("Invalid request type"),
];

export const getHolderVCsValidator = [
  query("holderDid")
    .trim()
    .notEmpty()
    .withMessage("Holder DID is required")
    .matches(/^did:[a-z0-9]+:[a-zA-Z0-9._-]+$/)
    .withMessage("Invalid holder DID format"),
];

export const credentialUpdateRequestValidator = [
  body("issuer_did")
    .trim()
    .notEmpty()
    .withMessage("Issuer DID is required")
    .matches(/^did:[a-z0-9]+:[a-zA-Z0-9._-]+$/)
    .withMessage("Invalid issuer DID format"),

  body("holder_did")
    .trim()
    .notEmpty()
    .withMessage("Holder DID is required")
    .matches(/^did:[a-z0-9]+:[a-zA-Z0-9._-]+$/)
    .withMessage("Invalid holder DID format"),

  body("encrypted_body")
    .trim()
    .notEmpty()
    .withMessage("Encrypted body is required"),
];

export const credentialRenewalRequestValidator = [
  body("issuer_did")
    .trim()
    .notEmpty()
    .withMessage("Issuer DID is required")
    .matches(/^did:[a-z0-9]+:[a-zA-Z0-9._-]+$/)
    .withMessage("Invalid issuer DID format"),

  body("holder_did")
    .trim()
    .notEmpty()
    .withMessage("Holder DID is required")
    .matches(/^did:[a-z0-9]+:[a-zA-Z0-9._-]+$/)
    .withMessage("Invalid holder DID format"),

  body("encrypted_body")
    .trim()
    .notEmpty()
    .withMessage("Encrypted body is required"),
];

export const credentialRevocationRequestValidator = [
  body("issuer_did")
    .trim()
    .notEmpty()
    .withMessage("Issuer DID is required")
    .matches(/^did:[a-z0-9]+:[a-zA-Z0-9._-]+$/)
    .withMessage("Invalid issuer DID format"),

  body("holder_did")
    .trim()
    .notEmpty()
    .withMessage("Holder DID is required")
    .matches(/^did:[a-z0-9]+:[a-zA-Z0-9._-]+$/)
    .withMessage("Invalid holder DID format"),

  body("encrypted_body")
    .trim()
    .notEmpty()
    .withMessage("Encrypted body is required"),
];

export const addVCStatusBlockValidator = [
  body("vc_id")
    .trim()
    .notEmpty()
    .withMessage("VC ID is required"),

  body("issuer_did")
    .trim()
    .notEmpty()
    .withMessage("Issuer DID is required")
    .matches(/^did:[a-z0-9]+:[a-zA-Z0-9._-]+$/)
    .withMessage("Invalid issuer DID format"),

  body("holder_did")
    .trim()
    .notEmpty()
    .withMessage("Holder DID is required")
    .matches(/^did:[a-z0-9]+:[a-zA-Z0-9._-]+$/)
    .withMessage("Invalid holder DID format"),

  body("status")
    .isBoolean()
    .withMessage("Status must be a boolean"),

  body("hash")
    .trim()
    .notEmpty()
    .withMessage("Hash is required")
    .matches(/^0x[a-fA-F0-9]{64}$/)
    .withMessage("Invalid hash format"),
];

export const getVCStatusValidator = [
  param("vcId")
    .trim()
    .notEmpty()
    .withMessage("VC ID is required"),

  query("issuerDid")
    .trim()
    .notEmpty()
    .withMessage("Issuer DID is required")
    .matches(/^did:[a-z0-9]+:[a-zA-Z0-9._-]+$/)
    .withMessage("Invalid issuer DID format"),

  query("holderDid")
    .trim()
    .notEmpty()
    .withMessage("Holder DID is required")
    .matches(/^did:[a-z0-9]+:[a-zA-Z0-9._-]+$/)
    .withMessage("Invalid holder DID format"),
];
