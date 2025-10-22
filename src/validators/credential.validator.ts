import { body, query, param } from "express-validator";
import { RequestType, RequestStatus } from "@prisma/client";

/**
 * Credential Validators
 */
export const getHolderCredentialsValidator = [
  query("holder_did") // Check the query parameter named 'holder_did'
    .trim()
    .notEmpty()
    .withMessage("holder_did query parameter is required")
    .matches(/^did:[a-z0-9]+:[a-zA-Z0-9._-]+$/)
    .withMessage("Invalid holder_did format in query parameter"),
];
export const processIssuanceVCValidator = [
  body("request_id")
    .trim()
    .notEmpty()
    .withMessage("Request ID is required")
    .isUUID()
    .withMessage("Invalid request ID format (must be UUID)"),

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

  body("action")
    .trim()
    .notEmpty()
    .withMessage("Action is required")
    .isIn([RequestStatus.APPROVED, RequestStatus.REJECTED])
    .withMessage(`Action must be ${RequestStatus.APPROVED} or ${RequestStatus.REJECTED}`),

  body("request_type")
    .notEmpty()
    .withMessage("Request type is required")
    .isIn([RequestType.ISSUANCE])
    .withMessage(`Invalid request type for this endpoint. Must be ${RequestType.ISSUANCE}`),

  // Conditional validation for fields required on APPROVAL
  body("vc_id")
    .if(body("action").equals(RequestStatus.APPROVED))
    .trim()
    .notEmpty()
    .withMessage("vc_id is required when action is APPROVED"),
  // .isUUID() // Assuming VC ID is also UUID, adjust if needed
  // .withMessage("Invalid vc_id format (must be UUID)"),

  body("vc_type")
    .if(body("action").equals(RequestStatus.APPROVED))
    .trim()
    .notEmpty()
    .withMessage("vc_type is required when action is APPROVED"),

  body("schema_id")
    .if(body("action").equals(RequestStatus.APPROVED))
    .trim()
    .notEmpty()
    .withMessage("schema_id is required when action is APPROVED")
    .isUUID() // Assuming schema_id is UUID
    .withMessage("Invalid schema_id format (must be UUID)"),

  body("schema_version")
    .if(body("action").equals(RequestStatus.APPROVED))
    .notEmpty()
    .withMessage("schema_version is required when action is APPROVED")
    .isInt({ min: 1 })
    .withMessage("schema_version must be a positive integer"),

  body("vc_hash")
    .if(body("action").equals(RequestStatus.APPROVED))
    .trim()
    .notEmpty()
    .withMessage("vc_hash is required when action is APPROVED")
    .matches(/^0x[a-fA-F0-9]{64}$/) // Example validation for Keccak256 hash
    .withMessage("Invalid vc_hash format (must be a 64-character hex string starting with 0x)"),

  body("encrypted_body")
    .if(body("action").equals(RequestStatus.APPROVED))
    .trim()
    .notEmpty()
    .withMessage("Encrypted body is required when action is APPROVED"),
];

export const requestCredentialValidator = [
  body("encrypted_body") // Checks for encrypted_body
    .trim()
    .notEmpty()
    .withMessage("Encrypted body is required"),

  body("issuer_did") // Checks for issuer_did
    .trim()
    .notEmpty()
    .withMessage("Issuer DID is required")
    .matches(/^did:[a-z0-9]+:[a-zA-Z0-9._-]+$/)
    .withMessage("Invalid issuer DID format"),

  body("holder_did") // Checks for holder_did
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
