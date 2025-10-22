import express, { Router } from "express";
import * as credentialController from "../controllers/credential.controller";
import {
  requestCredentialValidator,
  getCredentialRequestsByTypeValidator,
  processCredentialResponseValidator,
  getHolderVCsValidator,
  credentialUpdateRequestValidator,
  credentialRenewalRequestValidator,
  credentialRevocationRequestValidator,
  addVCStatusBlockValidator,
  getVCStatusValidator,
  processIssuanceVCValidator,
  getHolderCredentialsValidator
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
 *                 example: did:ganesha:0x1234567890abcdef
 *                 description: DID of the credential holder
 *               issuer_did:
 *                 type: string
 *                 example: did:ganesha:0xabcdef1234567890
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
router.post("/requests", requestCredentialValidator, credentialController.requestCredential);

/**
 * @swagger
 * /credentials/get-requests:
 *   get:
 *     summary: Get credential requests by type
 *     description: Retrieve credential requests filtered by type (issuance, renewal, update, revocation)
 *     tags:
 *       - Verifiable Credential (VC) Lifecycle
 *     parameters:
 *       - in: query
 *         name: type
 *         required: true
 *         schema:
 *           type: string
 *           enum: [ISSUANCE, RENEWAL, UPDATE, REVOCATION]
 *         description: Type of credential request
 *       - in: query
 *         name: issuer_did
 *         schema:
 *           type: string
 *         description: Filter by issuer DID
 *       
 *     responses:
 *       200:
 *         description: List of credential requests
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
 *                       request_id:
 *                         type: string
 *                         format: uuid
 *                       type:
 *                         type: string
 *                       holder_did:
 *                         type: string
 *                       issuer_did:
 *                         type: string
 *                       status:
 *                         type: string
 *                       created_at:
 *                         type: string
 *                         format: date-time
 *       400:
 *         description: Invalid query parameters
 *       500:
 *         description: Internal server error
 */
router.get("/get-requests", getCredentialRequestsByTypeValidator, credentialController.getCredentialRequestsByType);

/**
 * @swagger
 * /credentials/response:
 *   post:
 *     summary: Process credential response
 *     description: Issuer approves or rejects credential request (issuance, renewal, or update)
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
 *               - action
 *             properties:
 *               request_id:
 *                 type: string
 *                 format: uuid
 *                 description: ID of the credential request
 *               action:
 *                 type: string
 *                 enum: [APPROVE, REJECT]
 *                 description: Action to take on the request
 *               rejection_reason:
 *                 type: string
 *                 description: Required if action is REJECT
 *               credential_data:
 *                 type: object
 *                 description: Credential data if approving
 *     responses:
 *       200:
 *         description: Credential response processed successfully
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
 *                   example: Kredensial berhasil diterbitkan
 *                 data:
 *                   type: object
 *                   properties:
 *                     vc_id:
 *                       type: string
 *                       format: uuid
 *                     status:
 *                       type: string
 *       400:
 *         description: Invalid request or validation error
 *       404:
 *         description: Request not found
 *       500:
 *         description: Internal server error
 */
router.post("/response", processCredentialResponseValidator, credentialController.processCredentialResponse);

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
router.get("/credentials", getHolderVCsValidator, credentialController.getHolderVCs);

/**
 * @swagger
 * /credentials/update-request:
 *   post:
 *     summary: Request credential update
 *     description: Holder requests to update an existing Verifiable Credential
 *     tags:
 *       - Verifiable Credential (VC) Lifecycle
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - vc_id
 *               - updated_data
 *             properties:
 *               vc_id:
 *                 type: string
 *                 format: uuid
 *                 description: ID of the credential to update
 *               updated_data:
 *                 type: object
 *                 description: Updated credential data
 *               reason:
 *                 type: string
 *                 description: Reason for update request
 *     responses:
 *       201:
 *         description: Update request created successfully
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
 *                   example: Permintaan update kredensial berhasil dibuat
 *                 data:
 *                   type: object
 *                   properties:
 *                     request_id:
 *                       type: string
 *                       format: uuid
 *       400:
 *         description: Invalid request data
 *       404:
 *         description: Credential not found
 *       500:
 *         description: Internal server error
 */
router.post("/update-request", credentialUpdateRequestValidator, credentialController.requestCredentialUpdate);

/**
 * @swagger
 * /credentials/renew-requests:
 *   post:
 *     summary: Request credential renewal
 *     description: Holder requests to renew an expiring or expired Verifiable Credential
 *     tags:
 *       - Verifiable Credential (VC) Lifecycle
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - vc_id
 *             properties:
 *               vc_id:
 *                 type: string
 *                 format: uuid
 *                 description: ID of the credential to renew
 *               reason:
 *                 type: string
 *                 description: Reason for renewal request
 *     responses:
 *       201:
 *         description: Renewal request created successfully
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
 *                   example: Permintaan renewal kredensial berhasil dibuat
 *                 data:
 *                   type: object
 *                   properties:
 *                     request_id:
 *                       type: string
 *                       format: uuid
 *       400:
 *         description: Invalid request data
 *       404:
 *         description: Credential not found
 *       500:
 *         description: Internal server error
 */
router.post("/renew-requests", credentialRenewalRequestValidator, credentialController.requestCredentialRenewal);

/**
 * @swagger
 * /credentials/revoke-request:
 *   post:
 *     summary: Request credential revocation
 *     description: Holder or issuer requests to revoke a Verifiable Credential
 *     tags:
 *       - Verifiable Credential (VC) Lifecycle
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - vc_id
 *               - reason
 *             properties:
 *               vc_id:
 *                 type: string
 *                 format: uuid
 *                 description: ID of the credential to revoke
 *               reason:
 *                 type: string
 *                 description: Reason for revocation
 *     responses:
 *       201:
 *         description: Revocation request created successfully
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
 *                   example: Permintaan revokasi kredensial berhasil dibuat
 *                 data:
 *                   type: object
 *                   properties:
 *                     request_id:
 *                       type: string
 *                       format: uuid
 *       400:
 *         description: Invalid request data
 *       404:
 *         description: Credential not found
 *       500:
 *         description: Internal server error
 */
router.post("/revoke-request", credentialRevocationRequestValidator, credentialController.requestCredentialRevocation);

/**
 * @swagger
 * /credentials/add-status-block:
 *   post:
 *     summary: Add VC status block to blockchain
 *     description: Record credential status change on the blockchain
 *     tags:
 *       - Verifiable Credential (VC) Lifecycle
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - vc_id
 *               - status
 *             properties:
 *               vc_id:
 *                 type: string
 *                 format: uuid
 *                 description: ID of the credential
 *               status:
 *                 type: string
 *                 enum: [ACTIVE, REVOKED, SUSPENDED, EXPIRED]
 *                 description: New status of the credential
 *               reason:
 *                 type: string
 *                 description: Reason for status change
 *     responses:
 *       201:
 *         description: Status block added to blockchain successfully
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
 *                   example: Status block berhasil ditambahkan ke blockchain
 *                 data:
 *                   type: object
 *                   properties:
 *                     block_hash:
 *                       type: string
 *                     block_index:
 *                       type: integer
 *       400:
 *         description: Invalid request data
 *       404:
 *         description: Credential not found
 *       500:
 *         description: Internal server error
 */
router.post("/add-status-block", addVCStatusBlockValidator, credentialController.addVCStatusBlock);

/**
 * @swagger
 * /credentials/{vcId}/status:
 *   get:
 *     summary: Get VC status
 *     description: Retrieve current status of a Verifiable Credential from blockchain
 *     tags:
 *       - Verifiable Credential (VC) Lifecycle
 *     parameters:
 *       - in: path
 *         name: vcId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID of the credential
 *     responses:
 *       200:
 *         description: Credential status retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     vc_id:
 *                       type: string
 *                       format: uuid
 *                     status:
 *                       type: string
 *                       enum: [ACTIVE, REVOKED, SUSPENDED, EXPIRED]
 *                     last_updated:
 *                       type: string
 *                       format: date-time
 *                     blockchain_hash:
 *                       type: string
 *       404:
 *         description: Credential not found
 *       500:
 *         description: Internal server error
 */
router.get("/:vcId/status", getVCStatusValidator, credentialController.getVCStatus);

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
 *                 example: did:ganesha:0xabcdef1234567890
 *                 description: DID of the issuer (must match original request)
 *               holder_did:
 *                 type: string
 *                 example: did:ganesha:0x1234567890abcdef
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
 *                 example: "0x..."
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
 *         example: did:ganesha:0x1234567890abcdef
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
 *                   example: "Successfully retrieved 2 credentials for holder did:ganesha:..."
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       vc_response_id:
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


export default router;
