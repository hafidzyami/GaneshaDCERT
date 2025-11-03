import express, { Router } from "express";
import * as credentialController from "../controllers/credential.controller";
import { verifyDIDSignature, adminAuthMiddleware } from "../middlewares";
import {
  requestCredentialValidator,
  getCredentialRequestsByTypeValidator,
  getHolderVCsValidator,
  credentialUpdateRequestValidator,
  credentialRenewalRequestValidator,
  credentialRevocationRequestValidator,
  getVCStatusValidator,
  processIssuanceVCValidator,
  getHolderCredentialsValidator, revokeVCValidator, processRenewalVCValidator, processUpdateVCValidator,
  claimVCValidator,
  confirmVCValidator,
  claimVCsBatchValidator,
  confirmVCsBatchValidator,
  resetStuckVCsValidator, getAllIssuerRequestsValidator
} from "../validators/credential.validator";

const router: Router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Verifiable Credential (VC) Lifecycle
 *   description: VC issuance, renewal, update, revocation, and status management
 */

/**
 * @swagger
 * /credentials/requests:
 *   post:
 *     summary: Request credential issuance
 *     description: Holder requests a new Verifiable Credential from an issuer
 *     tags:
 *       - Verifiable Credential (VC) Lifecycle
 *     security:
 *       - HolderBearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - holder_did
 *               - issuer_did
 *               - encrypted_body
 *             properties:
 *               holder_did:
 *                 type: string
 *                 example: did:dcert:1234567890abcdef
 *                 description: DID of the credential holder
 *               issuer_did:
 *                 type: string
 *                 example: did:dcert:string_hash
 *                 description: DID of the credential issuer
 *               encrypted_body:
 *                 type: string
 *                 format: uuid
 *                 description: ID of the VC schema to use
 *
 *     responses:
 *       201:
 *         description: Credential request created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Permintaan kredensial berhasil dibuat
 *                 data:
 *                   type: object
 *                   properties:
 *                     request_id:
 *                       type: string
 *                       format: uuid
 *                     status:
 *                       type: string
 *                       example: PENDING
 *       400:
 *         description: Validation error or invalid data
 *       404:
 *         description: Schema or DID not found
 *       500:
 *         description: Internal server error
 */
router.post(
  "/requests",
  verifyDIDSignature,
  requestCredentialValidator,
  credentialController.requestCredential
);

/**
 * @swagger
 * /credentials/get-requests:
 *   get:
 *     summary: Get credential requests by type
 *     description: Retrieve credential requests filtered by type (ISSUANCE, RENEWAL, UPDATE, REVOCATION). Requires providing at least one of issuer_did OR holder_did for filtering.
 *     tags:
 *       - Verifiable Credential (VC) Lifecycle
 *     parameters:
 *       - in: query
 *         name: type
 *         required: true
 *         schema:
 *           type: string
 *           enum: [ISSUANCE, RENEWAL, UPDATE, REVOCATION]
 *         description: Type of credential request.
 *       - in: query
 *         name: issuer_did
 *         required: false
 *         schema:
 *           type: string
 *         description: Filter by issuer DID. (Either this or holder_did is required).
 *         example: did:dcert:abcdef1234567890
 *       - in: query
 *         name: holder_did
 *         required: false
 *         schema:
 *           type: string
 *         description: Filter by holder DID. (Either this or issuer_did is required).
 *         example: did:dcert:1234567890abcdef
 *     responses:
 *       200:
 *         description: List of credential requests retrieved successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Successfully retrieved ISSUANCE requests."
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         format: uuid
 *                       issuer_did:
 *                         type: string
 *                       holder_did:
 *                         type: string
 *                       status:
 *                         type: string
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *       400:
 *         description: Invalid query parameters (e.g., missing type, invalid DID format, OR neither issuer_did nor holder_did provided).
 *       500:
 *         description: Internal server error.
 */
router.get(
  "/get-requests",
  getCredentialRequestsByTypeValidator,
  credentialController.getCredentialRequestsByType
);



/**
 * @swagger
 * /credentials/credentials:
 *   get:
 *     summary: Get holder's VCs
 *     description: Retrieve all Verifiable Credentials owned by a specific holder
 *     tags:
 *       - Verifiable Credential (VC) Lifecycle
 *     parameters:
 *       - in: query
 *         name: holder_did
 *         required: true
 *         schema:
 *           type: string
 *         description: DID of the credential holder

 *     responses:
 *       200:
 *         description: List of holder's credentials
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       vc_id:
 *                         type: string
 *                         format: uuid
 *                       holder_did:
 *                         type: string
 *                       issuer_did:
 *                         type: string
 *                       schema_name:
 *                         type: string
 *                       status:
 *                         type: string
 *                       issued_at:
 *                         type: string
 *                         format: date-time
 *                       expires_at:
 *                         type: string
 *                         format: date-time
 *       400:
 *         description: Missing or invalid holder_did
 *       500:
 *         description: Internal server error
 */
router.get(
  "/credentials",
  getHolderVCsValidator,
  credentialController.getHolderVCs
);

/**
 * @swagger
 * /credentials/update-request:
 *   post:
 *     summary: Request credential update (Creates DB record)
 *     description: Submits a request to update an existing Verifiable Credential. This creates a record in the database with PENDING status. The actual update processing happens separately.
 *     tags:
 *       - Verifiable Credential (VC) Lifecycle
 *     security:
 *       - HolderBearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - issuer_did
 *               - holder_did
 *               - encrypted_body
 *             properties:
 *               issuer_did:
 *                 type: string
 *                 example: did:ganesha:0xabcdef1234567890
 *                 description: DID of the credential issuer.
 *               holder_did:
 *                 type: string
 *                 example: did:ganesha:0x1234567890abcdef
 *                 description: DID of the credential holder.
 *               encrypted_body:
 *                 type: string
 *                 description: Encrypted payload containing the VC ID to update and the new data/reason.
 *     responses:
 *       201:
 *         description: Update request created successfully in the database.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Verifiable Credential update request submitted successfully."
 *                 data:
 *                   type: object
 *                   properties:
 *                     request_id:
 *                       type: string
 *                       format: uuid
 *                       description: The ID of the newly created VCUpdateRequest record.
 *       400:
 *         description: Validation error (e.g., missing fields, invalid DIDs).
 *       500:
 *         description: Internal server error.
 */
router.post(
  "/update-request",
  verifyDIDSignature,
  credentialUpdateRequestValidator,
  credentialController.requestCredentialUpdate
);

/**
 * @swagger
 * /credentials/renew-request:
 *   post:
 *     summary: Request credential renewal (Creates DB record)
 *     description: Submits a request to renew an expiring or expired Verifiable Credential. This creates a record in the database with PENDING status. The actual renewal processing happens separately.
 *     tags:
 *       - Verifiable Credential (VC) Lifecycle
 *     security:
 *       - HolderBearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - issuer_did
 *               - holder_did
 *               - encrypted_body
 *             properties:
 *               issuer_did:
 *                 type: string
 *                 example: did:ganesha:0xabcdef1234567890
 *                 description: DID of the credential issuer.
 *               holder_did:
 *                 type: string
 *                 example: did:ganesha:0x1234567890abcdef
 *                 description: DID of the credential holder.
 *               encrypted_body:
 *                 type: string
 *                 description: Encrypted payload containing the VC ID to renew and any required justification/data.
 *     responses:
 *       201:
 *         description: Renewal request created successfully in the database.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Verifiable Credential renewal request submitted successfully."
 *                 data:
 *                   type: object
 *                   properties:
 *                     request_id:
 *                       type: string
 *                       format: uuid
 *                       description: The ID of the newly created VCRenewalRequest record.
 *       400:
 *         description: Validation error (e.g., missing fields, invalid DIDs).
 *       500:
 *         description: Internal server error.
 */
router.post(
  "/renew-request",
  verifyDIDSignature,
  credentialRenewalRequestValidator,
  credentialController.requestCredentialRenewal
);

/**
 * @swagger
 * /credentials/revoke-request:
 *   post:
 *     summary: Request credential revocation (Creates DB record)
 *     description: Submits a request to revoke a Verifiable Credential. This creates a record in the database with PENDING status. The actual revocation processing happens separately (e.g., via an admin/issuer action).
 *     tags:
 *       - Verifiable Credential (VC) Lifecycle
 *     security:
 *       - HolderBearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - encrypted_body
 *               - issuer_did
 *               - holder_did
 *             properties:
 *               encrypted_body:
 *                 type: string
 *                 description: Encrypted payload containing the VC ID to revoke and the reason.
 *               issuer_did:
 *                 type: string
 *                 example: did:dcert:abcdef1234567890
 *                 description: DID of the entity requesting revocation (usually issuer or holder).
 *               holder_did:
 *                 type: string
 *                 example: did:dcert:1234567890abcdef
 *                 description: DID of the credential holder.
 *     responses:
 *       201:
 *         description: Revocation request created successfully in the database.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Verifiable Credential revocation request submitted successfully."
 *                 data:
 *                   type: object
 *                   properties:
 *                     request_id:
 *                       type: string
 *                       format: uuid
 *                       description: The ID of the newly created VCRevokeRequest record.
 *       400:
 *         description: Validation error (e.g., missing fields, invalid DIDs).
 *       500:
 *         description: Internal server error.
 */
router.post(
  "/revoke-request",
  verifyDIDSignature,
  credentialRevocationRequestValidator,
  credentialController.requestCredentialRevocation
);


/**
 * @swagger
 * /credentials/{vcId}/status:
 *   get:
 *     summary: Get VC status from Blockchain
 *     description: Retrieve the current status record of a Verifiable Credential directly from the blockchain using its ID.
 *     tags:
 *       - Verifiable Credential (VC) Lifecycle
 *     parameters:
 *       - in: path
 *         name: vcId
 *         required: true
 *         schema:
 *           type: string
 *         description: The unique identifier of the Verifiable Credential.
 *     responses:
 *       200:
 *         description: Credential status retrieved successfully from the blockchain.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Successfully retrieved status for VC ..."
 *                 data:
 *                   type: object
 *                   properties:
 *                     vc_id:
 *                       type: string
 *                     issuer_did:
 *                       type: string
 *                     holder_did:
 *                       type: string
 *                     vc_type:
 *                       type: string
 *                     schema_id:
 *                       type: string
 *                     schema_version:
 *                       type: integer
 *                     status:
 *                       type: boolean
 *                       description: Current status (true = active, false = inactive/revoked).
 *                     hash:
 *                       type: string
 *                       description: Stored hash of the VC on the blockchain.
 *       400:
 *         description: Invalid vcId format in URL.
 *       404:
 *         description: VC not found on the blockchain.
 *       500:
 *         description: Internal server error or blockchain communication error.
 */
router.get(
  "/:vcId/status",
  getVCStatusValidator,
  credentialController.getVCStatus
);

/**
 * @swagger
 * /credentials/issue-vc:
 *   post:
 *     summary: Process credential issuance (Approve/Reject)
 *     description: Issuer approves or rejects a specific credential issuance request, issuing it on the blockchain if approved.
 *     tags:
 *       - Verifiable Credential (VC) Lifecycle
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - request_id
 *               - issuer_did
 *               - holder_did
 *               - action
 *               - request_type
 *             properties:
 *               request_id:
 *                 type: string
 *                 format: uuid
 *                 description: ID of the VCIssuanceRequest to process
 *               issuer_did:
 *                 type: string
 *                 example: did:dcert:string_hash0
 *                 description: DID of the issuer (must match original request)
 *               holder_did:
 *                 type: string
 *                 example: did:dcert:string_hashf
 *                 description: DID of the holder (must match original request)
 *               action:
 *                 type: string
 *                 enum: [APPROVED, REJECTED]
 *                 description: Action to take (APPROVED or REJECTED)
 *               request_type:
 *                 type: string
 *                 enum: [ISSUANCE]
 *                 description: Must be ISSUANCE for this endpoint
 *               vc_id:
 *                 type: string
 *                 description: Unique ID for the new VC (Required if action is APPROVED)
 *               vc_type:
 *                 type: string
 *                 example: UniversityDegreeCredential
 *                 description: Type/Name of the VC (Required if action is APPROVED)
 *               schema_id:
 *                 type: string
 *                 format: uuid
 *                 description: ID of the schema used (Required if action is APPROVED)
 *               schema_version:
 *                 type: integer
 *                 example: 1
 *                 description: Version of the schema used (Required if action is APPROVED)
 *               vc_hash:
 *                 type: string
 *                 example: "string_hash"
 *                 description: Hash of the VC data (Required if action is APPROVED)
 *               encrypted_body:
 *                 type: string
 *                 description: Encrypted VC data (Required if action is APPROVED)
 *     responses:
 *       200:
 *         description: Request processed successfully (Approved or Rejected)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Verifiable Credential issued successfully on blockchain and database."
 *                 data:
 *                   type: object
 *                   properties:
 *                     request_id:
 *                       type: string
 *                       format: uuid
 *                     status:
 *                       type: string
 *                       enum: [APPROVED, REJECTED]
 *                     vc_response_id:
 *                       type: string
 *                       format: uuid
 *                       description: Present only if action was APPROVED
 *                     transaction_hash:
 *                       type: string
 *                       description: Blockchain transaction hash (Present only if action was APPROVED)
 *                     block_number:
 *                       type: integer
 *                       description: Blockchain block number (Present only if action was APPROVED)
 *       400:
 *         description: Validation error, mismatched DIDs, request already processed, missing required fields for approval, or blockchain error.
 *       404:
 *         description: Issuance request not found.
 *       500:
 *         description: Internal server error.
 */
router.post(
  "/issue-vc", // The new endpoint path
  processIssuanceVCValidator, // Apply the specific validator
  credentialController.processIssuanceVC // Use the specific controller function
);

/**
 * @swagger
 * /credentials/get-credentials-from-db:
 *   get:
 *     summary: Get holder's issued VCs from DB
 *     description: Retrieve all Verifiable Credentials issued to a specific holder from the database
 *     tags:
 *       - Verifiable Credential (VC) Lifecycle
 *     parameters:
 *       - in: query
 *         name: holder_did
 *         required: true
 *         schema:
 *           type: string
 *         example: did:dcert:string_hashf
 *         description: DID of the credential holder whose VCs are requested
 *     responses:
 *       200:
 *         description: List of holder's credential metadata retrieved successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Successfully retrieved 2 credentials for holder did:dcert:..."
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         format: uuid
 *                       order_id: # Added
 *                         type: string
 *                         format: uuid
 *                       request_id:
 *                         type: string
 *                         format: uuid
 *                       request_type:
 *                         type: string
 *                         enum: [ISSUANCE, RENEWAL, UPDATE, REVOKE]
 *                       issuer_did:
 *                         type: string
 *                       holder_did:
 *                         type: string
 *                       encrypted_body: # Added
 *                         type: string
 *                         description: The encrypted VC data
 *       400:
 *         description: Missing or invalid holder_did query parameter.
 *       500:
 *         description: Internal server error.
 */
router.get(
  "/get-credentials-from-db",
  getHolderCredentialsValidator,
  credentialController.getHolderCredentialsFromDB
);

/**
 * @swagger
 * /credentials/revoke-vc:
 *   post:
 *     summary: Process VC revocation request (Approve/Reject)
 *     description: Processes a request stored in the VCRevokeRequest table. If approved, verifies the target VC on-chain and then revokes it on the blockchain, updating the request status in the DB. If rejected, only updates the request status in the DB.
 *     tags:
 *       - Verifiable Credential (VC) Lifecycle
 *     security:
 *       - InstitutionBearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - request_id
 *               - issuer_did
 *               - holder_did
 *               - action
 *             properties:
 *               request_id:
 *                 type: string
 *                 format: uuid
 *                 description: The ID of the VCRevokeRequest record to process.
 *               issuer_did:
 *                 type: string
 *                 description: Issuer DID (must match the one in the VCRevokeRequest).
 *               holder_did:
 *                 type: string
 *                 description: Holder DID (must match the one in the VCRevokeRequest).
 *               action:
 *                 type: string
 *                 enum: [APPROVED, REJECTED]
 *                 description: Action to take on the revocation request.
 *               vc_id:
 *                 type: string
 *                 description: The ID of the actual VC to revoke (Required only if action is APPROVED).
 *     responses:
 *       200:
 *         description: Revocation request processed successfully (Approved or Rejected).
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Verifiable Credential revocation request approved and VC revoked on blockchain."
 *                 data:
 *                   type: object
 *                   properties:
 *                     request_id:
 *                       type: string
 *                       format: uuid
 *                     status:
 *                       type: string
 *                       enum: [APPROVED, REJECTED]
 *                     transaction_hash:
 *                       type: string
 *                       description: Blockchain transaction hash (Present only if action was APPROVED and blockchain call succeeded).
 *                     block_number:
 *                       type: integer
 *                       description: Blockchain block number (Present only if action was APPROVED and blockchain call succeeded).
 *       400:
 *         description: Validation error, mismatched DIDs, request already processed, VC already revoked on chain, missing vc_id for approval, or blockchain error.
 *       404:
 *         description: Revocation request (request_id) not found in DB, or target VC (vc_id) not found on blockchain when approving.
 *       500:
 *         description: Internal server error.
 */
router.post(
  "/revoke-vc", // The new POST endpoint path
  revokeVCValidator, // Apply the validator
  credentialController.revokeVC // Use the specific controller function
);


/**
 * @swagger
 * /credentials/renew-vc:
 *   post:
 *     summary: Process VC renewal request (Approve/Reject)
 *     description: Processes a request stored in the VCRenewalRequest table. If approved, calls the renew function on the blockchain for the specified VC, updates the request status, and stores the new encrypted VC body in VCResponse. If rejected, only updates the request status.
 *     tags:
 *       - Verifiable Credential (VC) Lifecycle
 *     security:
 *       - InstitutionBearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - request_id
 *               - issuer_did
 *               - holder_did
 *               - action
 *             properties:
 *               request_id:
 *                 type: string
 *                 format: uuid
 *                 description: The ID of the VCRenewalRequest record to process.
 *               issuer_did:
 *                 type: string
 *                 description: Issuer DID (must match the one in the VCRenewalRequest).
 *               holder_did:
 *                 type: string
 *                 description: Holder DID (must match the one in the VCRenewalRequest).
 *               action:
 *                 type: string
 *                 enum: [APPROVED, REJECTED]
 *                 description: Action to take on the renewal request.
 *               vc_id:
 *                 type: string
 *                 description: The ID of the actual VC to renew on the blockchain (Required only if action is APPROVED).
 *               encrypted_body:
 *                 type: string
 *                 description: The new encrypted body of the renewed VC (Required only if action is APPROVED).
 *     responses:
 *       200:
 *         description: Renewal request processed successfully (Approved or Rejected).
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Verifiable Credential renewal request approved and VC renewed on blockchain."
 *                 data:
 *                   type: object
 *                   properties:
 *                     request_id:
 *                       type: string
 *                       format: uuid
 *                     status:
 *                       type: string
 *                       enum: [APPROVED, REJECTED]
 *                     vc_response_id:
 *                       type: string
 *                       format: uuid
 *                       description: The ID of the new VCResponse record created upon approval.
 *                     transaction_hash:
 *                       type: string
 *                       description: Blockchain transaction hash (Present only if action was APPROVED and blockchain call succeeded).
 *                     block_number:
 *                       type: integer
 *                       description: Blockchain block number (Present only if action was APPROVED and blockchain call succeeded).
 *       400:
 *         description: Validation error, mismatched DIDs, request already processed, missing vc_id/encrypted_body for approval, or blockchain error.
 *       404:
 *         description: Renewal request (request_id) not found in DB, or target VC (vc_id) not found on blockchain when approving.
 *       500:
 *         description: Internal server error.
 */
router.post(
  "/renew-vc", // The new POST endpoint path
  processRenewalVCValidator, // Apply the validator
  credentialController.processRenewalVC // Use the specific controller function
);

/**
 * @swagger
 * /credentials/update-vc:
 *   post:
 *     summary: Process VC update request (Approve/Reject)
 *     description: Processes a request stored in the VCUpdateRequest table. If approved, checks the target VC on-chain, updates its hash on the blockchain, updates the request status, and stores the new encrypted VC body in VCResponse. If rejected, only updates the request status.
 *     tags:
 *       - Verifiable Credential (VC) Lifecycle
 *     security:
 *       - InstitutionBearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - request_id
 *               - issuer_did
 *               - holder_did
 *               - action
 *             properties:
 *               request_id:
 *                 type: string
 *                 format: uuid
 *                 description: The ID of the VCUpdateRequest record to process.
 *               issuer_did:
 *                 type: string
 *                 description: Issuer DID (must match the one in the VCUpdateRequest).
 *               holder_did:
 *                 type: string
 *                 description: Holder DID (must match the one in the VCUpdateRequest).
 *               action:
 *                 type: string
 *                 enum: [APPROVED, REJECTED]
 *                 description: Action to take on the update request.
 *               vc_id:
 *                 type: string
 *                 description: The ID of the original VC to update on the blockchain (Required only if action is APPROVED).
 *               new_vc_hash:
 *                 type: string
 *                 example: "0x..."
 *                 description: The new hash representing the updated VC data (Required only if action is APPROVED).
 *               encrypted_body:
 *                 type: string
 *                 description: The new encrypted body of the updated VC (Required only if action is APPROVED).
 *     responses:
 *       200:
 *         description: Update request processed successfully (Approved or Rejected).
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Verifiable Credential update request approved and VC updated on blockchain."
 *                 data:
 *                   type: object
 *                   properties:
 *                     request_id:
 *                       type: string
 *                       format: uuid
 *                     status:
 *                       type: string
 *                       enum: [APPROVED, REJECTED]
 *                     vc_response_id:
 *                       type: string
 *                       format: uuid
 *                       description: The ID of the new VCResponse record created upon approval.
 *                     transaction_hash:
 *                       type: string
 *                       description: Blockchain transaction hash (Present only if action was APPROVED and blockchain call succeeded).
 *                     block_number:
 *                       type: integer
 *                       description: Blockchain block number (Present only if action was APPROVED and blockchain call succeeded).
 *       400:
 *         description: Validation error, mismatched DIDs, request already processed, VC inactive/revoked on chain, missing required fields for approval, or blockchain error.
 *       404:
 *         description: Update request (request_id) not found in DB, or target VC (vc_id) not found on blockchain when approving.
 *       500:
 *         description: Internal server error.
 */
router.post(
  "/update-vc", // The new POST endpoint path
  processUpdateVCValidator, // Apply the validator
  credentialController.processUpdateVC // Use the specific controller function
);

/**
 * @swagger
 * /credentials/claim:
 *   post:
 *     summary: Claim a pending VC (Phase 1)
 *     description: Atomically claims a pending VC for the holder. Sets status to PROCESSING and returns the VC for the holder to save locally.
 *     tags:
 *       - Verifiable Credential (VC) Lifecycle
 *     security:
 *       - HolderBearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - holder_did
 *             properties:
 *               holder_did:
 *                 type: string
 *                 example: did:dcert:u1234567890abcdef1234567890abcdef12345678
 *                 description: DID of the credential holder
 *     responses:
 *       200:
 *         description: VC claimed successfully or no pending VCs available
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "VC claimed successfully. Please save it and confirm."
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                     encrypted_body:
 *                       type: string
 *                     status:
 *                       type: string
 *                       example: PROCESSING
 *       400:
 *         description: Validation error
 *       500:
 *         description: Internal server error
 */
router.post(
  "/claim",
  verifyDIDSignature,
  claimVCValidator,
  credentialController.claimVC
);


/**
 * @swagger
 * /credentials/confirm:
 *   post:
 *     summary: Confirm VC claim (Phase 2)
 *     description: Confirms that the holder has saved the VC locally. Sets status to CLAIMED and soft-deletes the record.
 *     tags:
 *       - Verifiable Credential (VC) Lifecycle
 *     security:
 *       - HolderBearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - vc_id
 *               - holder_did
 *             properties:
 *               vc_id:
 *                 type: string
 *                 format: uuid
 *                 description: ID of the VC being confirmed
 *               holder_did:
 *                 type: string
 *                 example: did:dcert:u1234567890abcdef1234567890abcdef12345678
 *                 description: DID of the credential holder
 *     responses:
 *       200:
 *         description: VC confirmed and soft-deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "VC claimed and confirmed successfully."
 *                 data:
 *                   type: object
 *                   properties:
 *                     message:
 *                       type: string
 *                     vc_id:
 *                       type: string
 *                       format: uuid
 *       400:
 *         description: Validation error
 *       404:
 *         description: VC not found or not in PROCESSING state
 *       500:
 *         description: Internal server error
 */
router.post(
  "/confirm",
  verifyDIDSignature,
  confirmVCValidator,
  credentialController.confirmVC
);

/**
 * @swagger
 * /credentials/claim-batch:
 *   post:
 *     summary: Claim multiple pending VCs in batch (Phase 1 - Batch)
 *     description: Atomically claims up to N pending VCs for the holder in a single request. More efficient than claiming one-by-one. Default limit is 10, maximum is 100.
 *     tags:
 *       - Verifiable Credential (VC) Lifecycle
 *     security:
 *       - HolderBearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - holder_did
 *             properties:
 *               holder_did:
 *                 type: string
 *                 example: did:dcert:u1234567890abcdef1234567890abcdef12345678
 *                 description: DID of the credential holder
 *               limit:
 *                 type: integer
 *                 example: 10
 *                 minimum: 1
 *                 maximum: 100
 *                 default: 10
 *                 description: Maximum number of VCs to claim (default 10, max 100)
 *     responses:
 *       200:
 *         description: VCs claimed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Successfully claimed 10 VCs. 5 more pending."
 *                 data:
 *                   type: object
 *                   properties:
 *                     claimed_vcs:
 *                       type: array
 *                       description: Array of claimed VCs
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             format: uuid
 *                           encrypted_body:
 *                             type: string
 *                           status:
 *                             type: string
 *                             example: PROCESSING
 *                           processing_at:
 *                             type: string
 *                             format: date-time
 *                     claimed_count:
 *                       type: integer
 *                       example: 10
 *                       description: Number of VCs successfully claimed
 *                     remaining_count:
 *                       type: integer
 *                       example: 5
 *                       description: Number of pending VCs still available
 *                     has_more:
 *                       type: boolean
 *                       example: true
 *                       description: Whether there are more pending VCs to claim
 *       400:
 *         description: Validation error
 *       500:
 *         description: Internal server error
 */
router.post(
  "/claim-batch",
  verifyDIDSignature,
  claimVCsBatchValidator,
  credentialController.claimVCsBatch
);

/**
 * @swagger
 * /credentials/confirm-batch:
 *   post:
 *     summary: Confirm multiple VC claims in batch (Phase 2 - Batch)
 *     description: Confirms that the holder has saved multiple VCs locally. Sets status to CLAIMED and soft-deletes the records. Use this after successfully claiming VCs with /claim-batch.
 *     tags:
 *       - Verifiable Credential (VC) Lifecycle
 *     security:
 *       - HolderBearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - vc_ids
 *               - holder_did
 *             properties:
 *               vc_ids:
 *                 type: array
 *                 minItems: 1
 *                 maxItems: 100
 *                 items:
 *                   type: string
 *                   format: uuid
 *                 example: ["550e8400-e29b-41d4-a716-446655440000", "6ba7b810-9dad-11d1-80b4-00c04fd430c8"]
 *                 description: Array of VC IDs to confirm (max 100)
 *               holder_did:
 *                 type: string
 *                 example: did:dcert:u1234567890abcdef1234567890abcdef12345678
 *                 description: DID of the credential holder
 *     responses:
 *       200:
 *         description: VCs confirmed and soft-deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Successfully confirmed 10 VCs."
 *                 data:
 *                   type: object
 *                   properties:
 *                     message:
 *                       type: string
 *                       example: "Successfully confirmed 10 VCs."
 *                     confirmed_count:
 *                       type: integer
 *                       example: 10
 *                       description: Number of VCs successfully confirmed
 *                     requested_count:
 *                       type: integer
 *                       example: 10
 *                       description: Number of VCs requested for confirmation
 *       400:
 *         description: Validation error
 *       404:
 *         description: No VCs found in PROCESSING state for confirmation
 *       500:
 *         description: Internal server error
 */
router.post(
  "/confirm-batch",
  verifyDIDSignature,
  confirmVCsBatchValidator,
  credentialController.confirmVCsBatch
);

/**
 * @swagger
 * /credentials/admin/reset-stuck:
 *   post:
 *     summary: Admin - Reset stuck PROCESSING VCs
 *     description: |
 *       Admin endpoint to manually reset VCs stuck in PROCESSING status back to PENDING.
 *       This is useful for cleaning up VCs that failed to complete the claim-confirm cycle.
 *
 *       The background scheduler automatically runs this every 5 minutes with a 15-minute timeout,
 *       but admins can trigger it manually with custom timeout if needed.
 *     tags:
 *       - Verifiable Credential (VC) Lifecycle
 *       - Admin
 *     security:
 *       - AdminBearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               timeout_minutes:
 *                 type: integer
 *                 description: Minutes threshold for stuck VCs (default 15, max 120)
 *                 example: 15
 *                 minimum: 1
 *                 maximum: 120
 *     responses:
 *       200:
 *         description: Cleanup job completed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Successfully reset 5 stuck VCs back to PENDING"
 *                 data:
 *                   type: object
 *                   properties:
 *                     reset_count:
 *                       type: integer
 *                       example: 5
 *                       description: Number of VCs reset from PROCESSING to PENDING
 *                     timeout_minutes:
 *                       type: integer
 *                       example: 15
 *                       description: Timeout threshold used for cleanup
 *                     cutoff_time:
 *                       type: string
 *                       format: date-time
 *                       example: "2025-10-31T10:15:00.000Z"
 *                       description: VCs in PROCESSING before this time were reset
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized - Invalid or missing admin token
 *       403:
 *         description: Forbidden - User is not an admin
 *       500:
 *         description: Internal server error
 */
router.post(
  "/admin/reset-stuck",
  adminAuthMiddleware,
  resetStuckVCsValidator,
  credentialController.resetStuckVCs
);

/**
 * @swagger
 * /credentials/issuer-history:
 *   get:
 *     summary: Get all requests for an issuer (Aggregated)
 *     description: Retrieve all ISSUANCE, RENEWAL, UPDATE, and REVOKE requests associated with a specific issuer DID. This endpoint is protected and requires issuer authentication.
 *     tags:
 *       - Verifiable Credential (VC) Lifecycle
 *     security:
 *       - HolderBearerAuth: []
 *     parameters:
 *       - in: query
 *         name: issuer_did
 *         required: true
 *         schema:
 *           type: string
 *         description: The DID of the issuer.
 *         example: did:dcert:i...
 *       - in: query
 *         name: status
 *         required: false
 *         schema:
 *           type: string
 *           enum: [PENDING, APPROVED, REJECTED, ALL]
 *         description: Filter requests by status (e.g., PENDING). Omitting this or using 'ALL' will return all statuses.
 *     responses:
 *       200:
 *         description: A list of all requests for the issuer, sorted by date (newest first).
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Successfully retrieved 25 requests for issuer."
 *                 data:
 *                   type: object
 *                   properties:
 *                     count:
 *                       type: integer
 *                       example: 25
 *                     requests:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             format: uuid
 *                           request_type:
 *                             type: string
 *                             enum: [ISSUANCE, RENEWAL, UPDATE, REVOKE]
 *                           issuer_did:
 *                             type: string
 *                           holder_did:
 *                             type: string
 *                           status:
 *                             type: string
 *                             enum: [PENDING, APPROVED, REJECTED]
 *                           encrypted_body:
 *                             type: string
 *                           createdAt:
 *                             type: string
 *                             format: date-time
 *       400:
 *         description: Validation error (e.g., missing issuer_did).
 *       401:
 *         description: Unauthorized (Invalid or missing JWT token).
 *       500:
 *         description: Internal server error.
 */
router.get(
  "/issuer-history",
  verifyDIDSignature,
  getAllIssuerRequestsValidator,
  credentialController.getAllIssuerRequests
);
export default router;
