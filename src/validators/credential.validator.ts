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
    .matches(/^did:dcert:[iu](?:[a-zA-Z0-9_-]{44}|[a-zA-Z0-9_-]{87})$/)
    .withMessage("Invalid holder_did format in query parameter"),
];
export const processIssuanceVCValidator = [
  body("request_id")
    .trim()
    .notEmpty()
    .withMessage("Request ID is required")
    .isUUID()
    .withMessage("Invalid request ID format (must be UUID)"),

  body("action")
    .trim()
    .notEmpty()
    .withMessage("Action is required")
    .isIn([RequestStatus.APPROVED, RequestStatus.REJECTED])
    .withMessage(
      `Action must be ${RequestStatus.APPROVED} or ${RequestStatus.REJECTED}`
    ),

  // Conditional validation for fields required on APPROVAL
  body("vc_id")
    .if(body("action").equals(RequestStatus.APPROVED))
    .trim()
    .notEmpty()
    .withMessage("vc_id is required when action is APPROVED"),
  // .isUUID() // Assuming VC ID is also UUID, adjust if needed
  // .withMessage("Invalid vc_id format (must be UUID)"),

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
    .matches(/^[a-fA-F0-9]{64}$/)
    .withMessage("Invalid vc_hash format (must be a 64-character hex string)"),

  body("encrypted_body")
    .if(body("action").equals(RequestStatus.APPROVED))
    .trim()
    .notEmpty()
    .withMessage("Encrypted body is required when action is APPROVED"),

  body("expired_at")
    .if(body("action").equals(RequestStatus.APPROVED))
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isISO8601()
    .withMessage(
      "expired_at must be a valid ISO 8601 date string (e.g., 2030-12-31T23:59:59.000Z)"
    ),
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
    .matches(/^did:dcert:[iu](?:[a-zA-Z0-9_-]{44}|[a-zA-Z0-9_-]{87})$/)
    .withMessage("Invalid issuer DID format"),

  body("holder_did") // Checks for holder_did
    .trim()
    .notEmpty()
    .withMessage("Holder DID is required")
    .matches(/^did:dcert:[iu](?:[a-zA-Z0-9_-]{44}|[a-zA-Z0-9_-]{87})$/)
    .withMessage("Invalid holder DID format")
    .custom((value, { req }) => {
      if (value === req.body.issuer_did) {
        throw new Error("Issuer DID and Holder DID cannot be the same.");
      }
      return true;
    }),
];

const requireAtLeastOneDid: CustomValidator = (value, { req }) => {
  if (!req.query?.issuer_did && !req.query?.holder_did) {
    throw new Error(
      "At least one of issuer_did or holder_did must be provided as a query parameter."
    );
  }
  return true;
};
export const getAllIssuerRequestsValidator = [
  query("issuer_did")
    .trim()
    .notEmpty()
    .withMessage("issuer_did query parameter is required")
    .matches(/^did:dcert:[iu](?:[a-zA-Z0-9_-]{44}|[a-zA-Z0-9_-]{87})$/)
    .withMessage("Invalid issuer_did format in query parameter"),

  query("status")
    .optional()
    // Tambahkan 'ALL' ke daftar nilai yang valid
    .isIn([
      RequestStatus.PENDING,
      RequestStatus.APPROVED,
      RequestStatus.REJECTED,
      "ALL",
    ])
    // Perbarui pesan error
    .withMessage(
      "Invalid status filter. Must be PENDING, APPROVED, REJECTED, or ALL"
    ),
];
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
      "ALL",
    ])
    .withMessage(
      "Invalid request type query parameter. Must be ISSUANCE, RENEWAL, UPDATE, or REVOKE"
    ),

  query("issuer_did")
    .optional() // Keep optional
    .trim()
    .matches(/^did:dcert:[iu](?:[a-zA-Z0-9_-]{44}|[a-zA-Z0-9_-]{87})$/)
    .withMessage("Invalid issuer_did format in query parameter"),

  query("holder_did") // Add validation for holder_did
    .optional() // Make it optional individually
    .trim()
    .matches(/^did:dcert:[iu](?:[a-zA-Z0-9_-]{44}|[a-zA-Z0-9_-]{87})$/)
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
    .matches(/^did:dcert:[iu](?:[a-zA-Z0-9_-]{44}|[a-zA-Z0-9_-]{87})$/)
    .withMessage("Invalid issuer DID format"),

  body("holder_did")
    .trim()
    .notEmpty()
    .withMessage("Holder DID is required")
    .matches(/^did:dcert:[iu](?:[a-zA-Z0-9_-]{44}|[a-zA-Z0-9_-]{87})$/)
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
  query("holder_did")
    .trim()
    .notEmpty()
    .withMessage("Holder DID is required")
    .matches(/^did:dcert:[iu](?:[a-zA-Z0-9_-]{44}|[a-zA-Z0-9_-]{87})$/)
    .withMessage("Invalid holder DID format"),
];

export const credentialUpdateRequestValidator = [
  body("issuer_did")
    .trim()
    .notEmpty()
    .withMessage("Issuer DID is required")
    .matches(/^did:dcert:[iu](?:[a-zA-Z0-9_-]{44}|[a-zA-Z0-9_-]{87})$/)
    .withMessage("Invalid issuer DID format"),

  body("holder_did")
    .trim()
    .notEmpty()
    .withMessage("Holder DID is required")
    .matches(/^did:dcert:[iu](?:[a-zA-Z0-9_-]{44}|[a-zA-Z0-9_-]{87})$/)
    .withMessage("Invalid holder DID format")
    .custom((value, { req }) => {
      if (value === req.body.issuer_did) {
        throw new Error("Issuer DID and Holder DID cannot be the same.");
      }
      return true;
    }),

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
    .matches(/^did:dcert:[iu](?:[a-zA-Z0-9_-]{44}|[a-zA-Z0-9_-]{87})$/)
    .withMessage("Invalid issuer DID format"),

  body("holder_did")
    .trim()
    .notEmpty()
    .withMessage("Holder DID is required")
    .matches(/^did:dcert:[iu](?:[a-zA-Z0-9_-]{44}|[a-zA-Z0-9_-]{87})$/)
    .withMessage("Invalid holder DID format")
    .custom((value, { req }) => {
      if (value === req.body.issuer_did) {
        throw new Error("Issuer DID and Holder DID cannot be the same.");
      }
      return true;
    }),

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
    .matches(/^did:dcert:[iu](?:[a-zA-Z0-9_-]{44}|[a-zA-Z0-9_-]{87})$/)
    .withMessage("Invalid issuer DID format"),

  body("holder_did") // Validate holder_did
    .trim()
    .notEmpty()
    .withMessage("Holder DID is required")
    .matches(/^did:dcert:[iu](?:[a-zA-Z0-9_-]{44}|[a-zA-Z0-9_-]{87})$/)
    .withMessage("Invalid holder DID format")
    .custom((value, { req }) => {
      if (value === req.body.issuer_did) {
        throw new Error("Issuer DID and Holder DID cannot be the same.");
      }
      return true;
    }),

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
    .matches(/^did:dcert:[iu](?:[a-zA-Z0-9_-]{44}|[a-zA-Z0-9_-]{87})$/)
    .withMessage("Invalid issuer DID format"),

  body("holder_did")
    .trim()
    .notEmpty()
    .withMessage("Holder DID is required")
    .matches(/^did:dcert:[iu](?:[a-zA-Z0-9_-]{44}|[a-zA-Z0-9_-]{87})$/)
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
];
export const revokeVCValidator = [
  body("request_id")
    .trim()
    .notEmpty()
    .withMessage("Request ID is required")
    .isUUID()
    .withMessage("Invalid request ID format (must be UUID)"),

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

  // encrypted_body is required only if action is APPROVED
  body("encrypted_body")
    .if(body("action").equals(RequestStatus.APPROVED))
    .trim()
    .notEmpty()
    .withMessage("encrypted_body is required when action is APPROVED"),
];

export const processRenewalVCValidator = [
  body("request_id")
    .trim()
    .notEmpty()
    .withMessage("Request ID is required")
    .isUUID()
    .withMessage("Invalid request ID format (must be UUID)"),

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

  // encrypted_body is required only if action is APPROVED
  body("encrypted_body")
    .if(body("action").equals(RequestStatus.APPROVED))
    .trim()
    .notEmpty()
    .withMessage("encrypted_body is required when action is APPROVED"),

  body("expired_at")
    .if(body("action").equals(RequestStatus.APPROVED))
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isISO8601()
    .withMessage(
      "expired_at must be a valid ISO 8601 date string (e.g., 2030-12-31T23:59:59.000Z)"
    ),
];

export const processUpdateVCValidator = [
  body("request_id")
    .trim()
    .notEmpty()
    .withMessage("Request ID is required")
    .isUUID()
    .withMessage("Invalid request ID format (must be UUID)"),

  body("action")
    .trim()
    .notEmpty()
    .withMessage("Action is required")
    .isIn([RequestStatus.APPROVED, RequestStatus.REJECTED])
    .withMessage(
      `Action must be ${RequestStatus.APPROVED} or ${RequestStatus.REJECTED}`
    ),

  body("vc_id")
    .if(body("action").equals(RequestStatus.APPROVED))
    .trim()
    .notEmpty()
    .withMessage("vc_id (original VC ID) is required when action is APPROVED"),

  body("new_vc_id")
    .if(body("action").equals(RequestStatus.APPROVED))
    .trim()
    .notEmpty()
    .withMessage("new_vc_id is required when action is APPROVED"),

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
    .isUUID()
    .withMessage("Invalid schema_id format (must be UUID)"),

  body("schema_version")
    .if(body("action").equals(RequestStatus.APPROVED))
    .notEmpty()
    .withMessage("schema_version is required when action is APPROVED")
    .isInt({ min: 1 })
    .withMessage("schema_version must be a positive integer"),

  body("new_vc_hash")
    .if(body("action").equals(RequestStatus.APPROVED))
    .trim()
    .notEmpty()
    .withMessage("new_vc_hash is required when action is APPROVED")
    .matches(/^[a-fA-F0-9]{64}$/) // [MODIFIED] Removed 0x
    .withMessage(
      "Invalid new_vc_hash format (must be a 64-character hex string)" // [MODIFIED]
    ),

  body("encrypted_body")
    .if(body("action").equals(RequestStatus.APPROVED))
    .trim()
    .notEmpty()
    .withMessage(
      "encrypted_body (new VC data) is required when action is APPROVED"
    ),

  body("expired_at")
    .if(body("action").equals(RequestStatus.APPROVED))
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isISO8601()
    .withMessage(
      "expired_at must be a valid ISO 8601 date string (e.g., 2030-12-31T23:59:59.000Z)"
    ),
];

/**
 * Validator for Phase 1: Claim VC
 * Validates holder_did for claiming a pending VC
 */
export const claimVCValidator = [
  // Accept holder_did from either query or body
  query("holder_did")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("holder_did is required")
    .matches(/^did:dcert:[iu](?:[a-zA-Z0-9_-]{44}|[a-zA-Z0-9_-]{87})$/)
    .withMessage("Invalid holder_did format"),

  body("holder_did")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("holder_did is required")
    .matches(/^did:dcert:[iu](?:[a-zA-Z0-9_-]{44}|[a-zA-Z0-9_-]{87})$/)
    .withMessage("Invalid holder_did format"),
];

/**
 * Validator for Phase 2: Confirm VC
 * Validates vc_id and holder_did for confirming a claimed VC
 */
export const confirmVCValidator = [
  body("vc_id")
    .trim()
    .notEmpty()
    .withMessage("vc_id is required")
    .isUUID()
    .withMessage("Invalid vc_id format (must be UUID)"),

  body("holder_did")
    .trim()
    .notEmpty()
    .withMessage("holder_did is required")
    .matches(/^did:dcert:[iu](?:[a-zA-Z0-9_-]{44}|[a-zA-Z0-9_-]{87})$/)
    .withMessage("Invalid holder_did format"),
];

/**
 * Validator for Phase 1 Batch: Claim multiple VCs
 * Validates holder_did and optional limit for claiming multiple pending VCs
 */
export const claimVCsBatchValidator = [
  body("holder_did")
    .trim()
    .notEmpty()
    .withMessage("holder_did is required")
    .matches(/^did:dcert:[iu](?:[a-zA-Z0-9_-]{44}|[a-zA-Z0-9_-]{87})$/)
    .withMessage("Invalid holder_did format"),

  body("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("limit must be an integer between 1 and 100"),
];

/**
 * Validator for Phase 2 Batch: Confirm multiple VCs
 * Validates request_ids array and holder_did for confirming multiple claimed VCs
 */
export const confirmVCsBatchValidator = [
  body("request_ids")
    .isArray({ min: 1, max: 100 })
    .withMessage("request_ids must be an array with 1 to 100 UUIDs"),

  body("request_ids.*")
    .isUUID()
    .withMessage("Each request_id must be a valid UUID"),

  body("holder_did")
    .trim()
    .notEmpty()
    .withMessage("holder_did is required")
    .matches(/^did:dcert:[iu](?:[a-zA-Z0-9_-]{44}|[a-zA-Z0-9_-]{87})$/)
    .withMessage("Invalid holder_did format"),
];

/**
 * Validator for Admin: Reset stuck PROCESSING VCs
 * Validates optional timeout_minutes parameter for manual cleanup
 */
export const resetStuckVCsValidator = [
  body("timeout_minutes")
    .optional()
    .isInt({ min: 1, max: 120 })
    .withMessage("timeout_minutes must be an integer between 1 and 120"),
];

export const issuerIssueVCValidator = [
  body("issuer_did")
    .trim()
    .notEmpty()
    .withMessage("Issuer DID is required")
    .matches(/^did:dcert:i(?:[a-zA-Z0-9_-]{44}|[a-zA-Z0-9_-]{87})$/) // Harus 'i' (institution)
    .withMessage("Invalid issuer DID format (must be an institution DID)"),

  body("holder_did")
    .trim()
    .notEmpty()
    .withMessage("Holder DID is required")
    .matches(/^did:dcert:[iu](?:[a-zA-Z0-9_-]{44}|[a-zA-Z0-9_-]{87})$/)
    .withMessage("Invalid holder DID format")
    .custom((value, { req }) => {
      if (value === req.body.issuer_did) {
        throw new Error("Issuer DID and Holder DID cannot be the same.");
      }
      return true;
    }),

  body("vc_id").trim().notEmpty().withMessage("vc_id is required"),

  body("vc_type").trim().notEmpty().withMessage("vc_type is required"),

  body("schema_id")
    .trim()
    .notEmpty()
    .withMessage("schema_id is required")
    .isUUID()
    .withMessage("Invalid schema_id format (must be UUID)"),

  body("schema_version")
    .notEmpty()
    .withMessage("schema_version is required")
    .isInt({ min: 1 })
    .withMessage("schema_version must be a positive integer"),

  body("vc_hash")
    .trim()
    .notEmpty()
    .withMessage("vc_hash is required")
    .matches(/^[a-fA-F0-9]{64}$/) // [MODIFIED] Removed 0x
    .withMessage(
      "Invalid vc_hash format (must be a 64-character hex string)" // [MODIFIED]
    ),

  body("encrypted_body")
    .trim()
    .notEmpty()
    .withMessage("Encrypted body is required"),

  body("expiredAt")
    .trim()
    .notEmpty()
    .withMessage("expiredAt is required")
    .isISO8601() // Memastikan format timestamp valid
    .withMessage(
      "expiredAt must be a valid ISO 8601 date string (e.g., 2025-12-31T23:59:59.000Z)"
    ),
];

export const issuerUpdateVCValidator = [
  body("issuer_did")
    .trim()
    .notEmpty()
    .withMessage("Issuer DID is required")
    .matches(/^did:dcert:i(?:[a-zA-Z0-9_-]{44}|[a-zA-Z0-9_-]{87})$/)
    .withMessage("Invalid issuer DID format (must be an institution DID)"),

  body("holder_did")
    .trim()
    .notEmpty()
    .withMessage("Holder DID is required")
    .matches(/^did:dcert:[iu](?:[a-zA-Z0-9_-]{44}|[a-zA-Z0-9_-]{87})$/)
    .withMessage("Invalid holder DID format")
    .custom((value, { req }) => {
      if (value === req.body.issuer_did) {
        throw new Error("Issuer DID and Holder DID cannot be the same.");
      }
      return true;
    }),

  // Validasi ID VC Lama
  body("old_vc_id").trim().notEmpty().withMessage("old_vc_id is required"),

  // Validasi detail VC Baru
  body("new_vc_id").trim().notEmpty().withMessage("new_vc_id is required"),

  body("vc_type").trim().notEmpty().withMessage("vc_type is required"),

  body("schema_id")
    .trim()
    .notEmpty()
    .withMessage("schema_id is required")
    .isUUID()
    .withMessage("Invalid schema_id format (must be UUID)"),

  body("schema_version")
    .notEmpty()
    .withMessage("schema_version is required")
    .isInt({ min: 1 })
    .withMessage("schema_version must be a positive integer"),

  body("new_vc_hash")
    .trim()
    .notEmpty()
    .withMessage("new_vc_hash is required")
    .matches(/^[a-fA-F0-9]{64}$/) // [MODIFIED] Removed 0x
    .withMessage(
      "Invalid new_vc_hash format (must be a 64-character hex string)" // [MODIFIED]
    ),

  body("encrypted_body")
    .trim()
    .notEmpty()
    .withMessage("Encrypted body (new VC data) is required"),

  body("expiredAt")
    .trim()
    .notEmpty()
    .withMessage("expiredAt is required")
    .isISO8601()
    .withMessage("expiredAt must be a valid ISO 8601 date string"),
];

export const issuerRevokeVCValidator = [
  body("issuer_did")
    .trim()
    .notEmpty()
    .withMessage("Issuer DID is required")
    .matches(/^did:dcert:i(?:[a-zA-Z0-9_-]{44}|[a-zA-Z0-9_-]{87})$/) // Harus 'i' (institution)
    .withMessage("Invalid issuer DID format (must be an institution DID)"),

  // [NEW] Add validator for holder_did
  body("holder_did")
    .trim()
    .notEmpty()
    .withMessage("Holder DID is required")
    .matches(/^did:dcert:[iu](?:[a-zA-Z0-9_-]{44}|[a-zA-Z0-9_-]{87})$/)
    .withMessage("Invalid holder DID format")
    .custom((value, { req }) => {
      if (value === req.body.issuer_did) {
        throw new Error("Issuer DID and Holder DID cannot be the same.");
      }
      return true;
    }),

  body("vc_id").trim().notEmpty().withMessage("vc_id is required"),
  
  // [NEW] Add validator for encrypted_body
  body("encrypted_body")
    .trim()
    .notEmpty()
    .withMessage("Encrypted body (reason) is required"),
];

export const issuerRenewVCValidator = [
  body("issuer_did")
    .trim()
    .notEmpty()
    .withMessage("Issuer DID is required")
    .matches(/^did:dcert:i(?:[a-zA-Z0-9_-]{44}|[a-zA-Z0-9_-]{87})$/) // Harus 'i' (institution)
    .withMessage("Invalid issuer DID format (must be an institution DID)"),

  body("holder_did")
    .trim()
    .notEmpty()
    .withMessage("Holder DID is required")
    .matches(/^did:dcert:[iu](?:[a-zA-Z0-9_-]{44}|[a-zA-Z0-9_-]{87})$/)
    .withMessage("Invalid holder DID format")
    .custom((value, { req }) => {
      if (value === req.body.issuer_did) {
        throw new Error("Issuer DID and Holder DID cannot be the same.");
      }
      return true;
    }),

  body("vc_id")
    .trim()
    .notEmpty()
    .withMessage("vc_id (the VC ID to renew) is required"),

  body("encrypted_body")
    .trim()
    .notEmpty()
    .withMessage("Encrypted body (new renewed VC data) is required"),

  body("expiredAt")
    .trim()
    .notEmpty()
    .withMessage("expiredAt is required")
    .isISO8601()
    .withMessage(
      "expiredAt must be a valid ISO 8601 date string (e.g., 2025-12-31T23:59:59.000Z)"
    ),
];

export const claimIssuerInitiatedVCsBatchValidator = [
  body("holder_did")
    .trim()
    .notEmpty()
    .withMessage("holder_did is required")
    .matches(/^did:dcert:[iu](?:[a-zA-Z0-9_-]{44}|[a-zA-Z0-9_-]{87})$/)
    .withMessage("Invalid holder_did format"),

  body("limit")
    .optional()
    .isInt({ min: 1, max: 100 }) // Menggunakan batas 100
    .withMessage("limit must be an integer between 1 and 100"),
];

/**
 * Validator for Phase 2 Batch: Confirm VCs from VCinitiatedByIssuer
 */
export const confirmIssuerInitiatedVCsBatchValidator = [
  body("vc_ids")
    .isArray({ min: 1, max: 100 })
    .withMessage("vc_ids must be an array with 1 to 100 UUIDs"),

  body("vc_ids.*").isUUID().withMessage("Each vc_id must be a valid UUID"),

  body("holder_did")
    .trim()
    .notEmpty()
    .withMessage("holder_did is required")
    .matches(/^did:dcert:[iu](?:[a-zA-Z0-9_-]{44}|[a-zA-Z0-9_-]{87})$/)
    .withMessage("Invalid holder_did format"),
];

/**
 * Validator for VC Validation Endpoint
 * Validates the uploaded VC JSON and hash for ownership verification
 */
export const validateVCValidator = [
  body("vc_json")
    .notEmpty()
    .withMessage("vc_json is required")
    .isObject()
    .withMessage("vc_json must be a valid JSON object"),

  body("vc_json.id").notEmpty().withMessage("vc_json.id is required"),

  body("vc_json.expiredAt")
    .optional({ nullable: true })
    .isISO8601()
    .withMessage("expiredAt must be a valid ISO 8601 date string if provided"),

  body("vc_hash")
    .trim()
    .notEmpty()
    .withMessage("vc_hash is required")
    .matches(/^[a-fA-F0-9]{64}$/)
    .withMessage("Invalid vc_hash format (must be 64-character hex string)"),

  body("holder_did")
    .trim()
    .notEmpty()
    .withMessage("holder_did is required")
    .matches(/^did:dcert:[iu](?:[a-zA-Z0-9_-]{44}|[a-zA-Z0-9_-]{87})$/)
    .withMessage("Invalid holder_did format"),
];

export const claimCombinedVCsBatchValidator = [
  body("holder_did")
    .trim()
    .notEmpty()
    .withMessage("holder_did is required")
    .matches(/^did:dcert:[iu](?:[a-zA-Z0-9_-]{44}|[a-zA-Z0-9_-]{87})$/)
    .withMessage("Invalid holder_did format"),

  body("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("limit must be an integer between 1 and 100"),
];

/**
 * [NEW] Validator for Phase 2 Combined Batch: Confirm multiple VCs
 */
export const confirmCombinedVCsBatchValidator = [
  body("holder_did")
    .trim()
    .notEmpty()
    .withMessage("holder_did is required")
    .matches(/^did:dcert:[iu](?:[a-zA-Z0-9_-]{44}|[a-zA-Z0-9_-]{87})$/)
    .withMessage("Invalid holder_did format"),

  body("items")
    .isArray({ min: 1, max: 100 })
    .withMessage("items must be an array with 1 to 100 objects"),

  body("items.*.claimId")
    .trim()
    .notEmpty()
    .isUUID()
    .withMessage("Each item's claimId must be a valid UUID"),

  body("items.*.source")
    .trim()
    .isIn(["HOLDER_REQUEST", "ISSUER_INITIATED"])
    .withMessage(
      "Each item's source must be either 'HOLDER_REQUEST' or 'ISSUER_INITIATED'"
    ),
];

/**
 * Validator for DELETE /credentials/file
 * Validates the deletion of VC document file
 */
export const deleteVCDocumentValidator = [
  body("file_id")
    .trim()
    .notEmpty()
    .withMessage("file_id is required")
    .isUUID()
    .withMessage("file_id must be a valid UUID"),
];

/**
 * Validator for POST /credentials/issuer/vc
 * Validates storing issuer VC data
 */
export const storeIssuerVCDataValidator = [
  body("issuer_did")
    .trim()
    .notEmpty()
    .withMessage("issuer_did is required")
    .matches(/^did:dcert:[iu](?:[a-zA-Z0-9_-]{44}|[a-zA-Z0-9_-]{87})$/)
    .withMessage("Invalid issuer DID format"),

  body("encrypted_body")
    .trim()
    .notEmpty()
    .withMessage("encrypted_body is required")
    .isLength({ min: 1 })
    .withMessage("encrypted_body must not be empty"),
];

/**
 * Validator for GET /credentials/issuer/vc/:issuer_did
 * Validates retrieving issuer VC data
 */
export const getIssuerVCDataValidator = [
  param("issuer_did")
    .trim()
    .notEmpty()
    .withMessage("issuer_did is required")
    .matches(/^did:dcert:[iu](?:[a-zA-Z0-9_-]{44}|[a-zA-Z0-9_-]{87})$/)
    .withMessage("Invalid issuer DID format"),
];

/**
 * Validator for GET /credentials/issuer/vc/:id
 * Validates getting issuer VC data by ID
 */
export const getIssuerVCDataByIdValidator = [
  param("id")
    .trim()
    .notEmpty()
    .withMessage("id is required")
    .isUUID()
    .withMessage("id must be a valid UUID"),
];

/**
 * Validator for PUT /credentials/issuer/vc
 * Validates updating issuer VC data (replacing old encrypted_body with new one)
 */
export const updateIssuerVCDataValidator = [
  body("issuer_did")
    .trim()
    .notEmpty()
    .withMessage("issuer_did is required")
    .matches(/^did:dcert:[iu](?:[a-zA-Z0-9_-]{44}|[a-zA-Z0-9_-]{87})$/)
    .withMessage("Invalid issuer DID format"),

  body("old_encrypted_body")
    .trim()
    .notEmpty()
    .withMessage("old_encrypted_body is required")
    .isLength({ min: 1 })
    .withMessage("old_encrypted_body must not be empty"),

  body("new_encrypted_body")
    .trim()
    .notEmpty()
    .withMessage("new_encrypted_body is required")
    .isLength({ min: 1 })
    .withMessage("new_encrypted_body must not be empty"),
];
