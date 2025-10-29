import {
  body,
  query,
  param,
  ValidationChain,
  CustomValidator,
} from "express-validator";
import { RequestType, RequestStatus } from "@prisma/client";

/**
 * Credential Validators
 */
export const getHolderCredentialsValidator = [
  query("holder_did") // Check the query parameter named 'holder_did'
    .trim()
    .notEmpty()
    .withMessage("holder_did query parameter is required")
    .matches(/^(?:did:dcert:[iu][a-zA-Z0-9_-]{44}|[a-zA-Z0-9_-]{87})$/)
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
    .matches(/^(?:did:dcert:[iu][a-zA-Z0-9_-]{44}|[a-zA-Z0-9_-]{87})$/)
    .withMessage("Invalid issuer DID format"),

  body("holder_did")
    .trim()
    .notEmpty()
    .withMessage("Holder DID is required")
    .matches(/^(?:did:dcert:[iu][a-zA-Z0-9_-]{44}|[a-zA-Z0-9_-]{87})$/)
    .withMessage("Invalid holder DID format"),

  body("action")
    .trim()
    .notEmpty()
    .withMessage("Action is required")
    .isIn([RequestStatus.APPROVED, RequestStatus.REJECTED])
    .withMessage(
      `Action must be ${RequestStatus.APPROVED} or ${RequestStatus.REJECTED}`
    ),

  body("request_type")
    .notEmpty()
    .withMessage("Request type is required")
    .isIn([RequestType.ISSUANCE])
    .withMessage(
      `Invalid request type for this endpoint. Must be ${RequestType.ISSUANCE}`
    ),

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
    .matches(/^[a-fA-F0-9]{64}$/) // Example validation for Keccak256 hash
    .withMessage("Invalid vc_hash format (must be a 64-character)"),

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
    .matches(/^(?:did:dcert:[iu][a-zA-Z0-9_-]{44}|[a-zA-Z0-9_-]{87})$/)
    .withMessage("Invalid issuer DID format"),

  body("holder_did") // Checks for holder_did
    .trim()
    .notEmpty()
    .withMessage("Holder DID is required")
    .matches(/^(?:did:dcert:[iu][a-zA-Z0-9_-]{44}|[a-zA-Z0-9_-]{87})$/)
    .withMessage("Invalid holder DID format"),
];

const requireAtLeastOneDid: CustomValidator = (value, { req }) => {
  if (!req.query?.issuer_did && !req.query?.holder_did) {
    throw new Error(
      "At least one of issuer_did or holder_did must be provided as a query parameter."
    );
  }
  return true;
};

// MODIFIED Validator for GET /credentials/get-requests
export const getCredentialRequestsByTypeValidator: ValidationChain[] = [
  // Explicitly type as array
  query("type")
    .notEmpty()
    .withMessage("Request type query parameter is required")
    .isIn([
      RequestType.ISSUANCE,
      RequestType.RENEWAL,
      RequestType.UPDATE,
      RequestType.REVOKE,
    ])
    .withMessage(
      "Invalid request type query parameter. Must be ISSUANCE, RENEWAL, UPDATE, or REVOKE"
    ),

  query("issuer_did")
    .optional() // Keep optional
    .trim()
    .matches(/^(?:did:dcert:[iu][a-zA-Z0-9_-]{44}|[a-zA-Z0-9_-]{87})$/)
    .withMessage("Invalid issuer_did format in query parameter"),

  query("holder_did") // Add validation for holder_did
    .optional() // Make it optional individually
    .trim()
    .matches(/^(?:did:dcert:[iu][a-zA-Z0-9_-]{44}|[a-zA-Z0-9_-]{87})$/)
    .withMessage("Invalid holder_did format in query parameter"),

  // Add custom validation to ensure at least one DID is present
  query().custom(requireAtLeastOneDid),
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
    .matches(/^(?:did:dcert:[iu][a-zA-Z0-9_-]{44}|[a-zA-Z0-9_-]{87})$/)
    .withMessage("Invalid issuer DID format"),

  body("holder_did")
    .trim()
    .notEmpty()
    .withMessage("Holder DID is required")
    .matches(/^(?:did:dcert:[iu][a-zA-Z0-9_-]{44}|[a-zA-Z0-9_-]{87})$/)
    .withMessage("Invalid holder DID format"),

  body("encrypted_body")
    .trim()
    .notEmpty()
    .withMessage("Encrypted body is required"),

  body("request_type")
    .notEmpty()
    .withMessage("Request type is required")
    .isIn([
      RequestType.ISSUANCE,
      RequestType.RENEWAL,
      RequestType.UPDATE,
      RequestType.REVOKE,
    ])
    .withMessage("Invalid request type"),
];

export const getHolderVCsValidator = [
  query("holderDid")
    .trim()
    .notEmpty()
    .withMessage("Holder DID is required")
    .matches(/^(?:did:dcert:[iu][a-zA-Z0-9_-]{44}|[a-zA-Z0-9_-]{87})$/)
    .withMessage("Invalid holder DID format"),
];

export const credentialUpdateRequestValidator = [
  body("issuer_did")
    .trim()
    .notEmpty()
    .withMessage("Issuer DID is required")
    .matches(/^(?:did:dcert:[iu][a-zA-Z0-9_-]{44}|[a-zA-Z0-9_-]{87})$/)
    .withMessage("Invalid issuer DID format"),

  body("holder_did")
    .trim()
    .notEmpty()
    .withMessage("Holder DID is required")
    .matches(/^(?:did:dcert:[iu][a-zA-Z0-9_-]{44}|[a-zA-Z0-9_-]{87})$/)
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
    .matches(/^(?:did:dcert:[iu][a-zA-Z0-9_-]{44}|[a-zA-Z0-9_-]{87})$/)
    .withMessage("Invalid issuer DID format"),

  body("holder_did")
    .trim()
    .notEmpty()
    .withMessage("Holder DID is required")
    .matches(/^(?:did:dcert:[iu][a-zA-Z0-9_-]{44}|[a-zA-Z0-9_-]{87})$/)
    .withMessage("Invalid holder DID format"),

  body("encrypted_body")
    .trim()
    .notEmpty()
    .withMessage("Encrypted body is required"),
];

export const credentialRevocationRequestValidator = [
  // Name matches route usage
  body("issuer_did") // Validate issuer_did
    .trim()
    .notEmpty()
    .withMessage("Issuer DID is required")
    .matches(/^(?:did:dcert:[iu][a-zA-Z0-9_-]{44}|[a-zA-Z0-9_-]{87})$/)
    .withMessage("Invalid issuer DID format"),

  body("holder_did") // Validate holder_did
    .trim()
    .notEmpty()
    .withMessage("Holder DID is required")
    .matches(/^(?:did:dcert:[iu][a-zA-Z0-9_-]{44}|[a-zA-Z0-9_-]{87})$/)
    .withMessage("Invalid holder DID format"),

  body("encrypted_body")
    .trim()
    .notEmpty()
    .withMessage("Encrypted body is required"),
];

export const addVCStatusBlockValidator = [
  body("vc_id").trim().notEmpty().withMessage("VC ID is required"),

  body("issuer_did")
    .trim()
    .notEmpty()
    .withMessage("Issuer DID is required")
    .matches(/^(?:did:dcert:[iu][a-zA-Z0-9_-]{44}|[a-zA-Z0-9_-]{87})$/)
    .withMessage("Invalid issuer DID format"),

  body("holder_did")
    .trim()
    .notEmpty()
    .withMessage("Holder DID is required")
    .matches(/^(?:did:dcert:[iu][a-zA-Z0-9_-]{44}|[a-zA-Z0-9_-]{87})$/)
    .withMessage("Invalid holder DID format"),

  body("status").isBoolean().withMessage("Status must be a boolean"),

  body("hash")
    .trim()
    .notEmpty()
    .withMessage("Hash is required")
    .matches(/^[a-fA-F0-9]{64}$/)
    .withMessage("Invalid hash format"),
];

export const getVCStatusValidator = [
  param("vcId").trim().notEmpty().withMessage("VC ID is required"),

  query("issuerDid")
    .trim()
    .notEmpty()
    .withMessage("Issuer DID is required")
    .matches(/^(?:did:dcert:[iu][a-zA-Z0-9_-]{44}|[a-zA-Z0-9_-]{87})$/)
    .withMessage("Invalid issuer DID format"),

  query("holderDid")
    .trim()
    .notEmpty()
    .withMessage("Holder DID is required")
    .matches(/^(?:did:dcert:[iu][a-zA-Z0-9_-]{44}|[a-zA-Z0-9_-]{87})$/)
    .withMessage("Invalid holder DID format"),
];
export const revokeVCValidator = [
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
    .matches(/^(?:did:dcert:[iu][a-zA-Z0-9_-]{44}|[a-zA-Z0-9_-]{87})$/)
    .withMessage("Invalid issuer DID format"),

  body("holder_did")
    .trim()
    .notEmpty()
    .withMessage("Holder DID is required")
    .matches(/^(?:did:dcert:[iu][a-zA-Z0-9_-]{44}|[a-zA-Z0-9_-]{87})$/)
    .withMessage("Invalid holder DID format"),

  body("action")
    .trim()
    .notEmpty()
    .withMessage("Action is required")
    .isIn([RequestStatus.APPROVED, RequestStatus.REJECTED])
    .withMessage(
      `Action must be ${RequestStatus.APPROVED} or ${RequestStatus.REJECTED}`
    ),

  // vc_id is required only if action is APPROVED
  body("vc_id")
    .if(body("action").equals(RequestStatus.APPROVED))
    .trim()
    .notEmpty()
    .withMessage("vc_id is required when action is APPROVED"),
  // .isUUID() // Add format check if needed
  // .withMessage("Invalid vc_id format"),
];
