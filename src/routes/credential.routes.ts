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
 *               - vc_schema_id
 *             properties:
 *               holder_did:
 *                 type: string
 *                 example: did:ganesha:0x1234567890abcdef
 *                 description: DID of the credential holder
 *               issuer_did:
 *                 type: string
 *                 example: did:ganesha:0xabcdef1234567890
 *                 description: DID of the credential issuer
 *               vc_schema_id:
 *                 type: string
 *                 format: uuid
 *                 description: ID of the VC schema to use
 *               credential_data:
 *                 type: object
 *                 description: Additional credential data based on schema
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
 *       - in: query
 *         name: holder_did
 *         schema:
 *           type: string
 *         description: Filter by holder DID
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, APPROVED, REJECTED]
 *         description: Filter by request status
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
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [ACTIVE, EXPIRED, REVOKED, SUSPENDED]
 *         description: Filter by credential status
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

export default router;
