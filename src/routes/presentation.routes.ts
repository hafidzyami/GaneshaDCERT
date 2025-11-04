import express, { Router } from "express";
import * as vp from "../controllers/presentation.controller";
import {
  requestVPValidator,
  getVPRequestDetailsValidator,
  storeVPValidator,
  getVPValidator,
  verifyVPValidator,
} from "../validators/presentation.validator";
import { verifyDIDSignature } from "../middlewares/didAuth.middleware";

const router: Router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Verification & Presentation (VP) Flow
 *   description: Verifiable Presentation request and sharing endpoints
 */

/**
 * @swagger
 * /presentations/request:
 *   post:
 *     summary: Request Verifiable Presentation
 *     description: Verifier requests a Verifiable Presentation from a holder
 *     tags:
 *       - Verification & Presentation (VP) Flow
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - verifier_did
 *               - holder_did
 *               - requested_credentials
 *             properties:
 *               verifier_did:
 *                 type: string
 *                 example: did:dcert:verifier123
 *                 description: DID of the verifier requesting the VP
 *               holder_did:
 *                 type: string
 *                 example: did:dcert:holder456
 *                 description: DID of the holder who should provide the VP
 *               requested_credentials:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     schema_id:
 *                       type: string
 *                       format: uuid
 *                       description: ID of the credential schema being requested
 *                     required_fields:
 *                       type: array
 *                       items:
 *                         type: string
 *                       description: Specific fields required from the credential
 *                 description: List of credentials being requested
 *               purpose:
 *                 type: string
 *                 example: Employment verification
 *                 description: Purpose of the verification request
 *               challenge:
 *                 type: string
 *                 description: Optional challenge string for additional security
 *     responses:
 *       201:
 *         description: VP request created successfully
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
 *                   example: Permintaan VP berhasil dibuat
 *                 data:
 *                   type: object
 *                   properties:
 *                     vp_request_id:
 *                       type: string
 *                       format: uuid
 *                     status:
 *                       type: string
 *                       example: PENDING
 *                     expires_at:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Invalid request data
 *       404:
 *         description: Verifier or holder DID not found
 *       500:
 *         description: Internal server error
 */
router.post("/request", requestVPValidator, vp.requestVP);

/**
 * @swagger
 * /presentations/request/{vpReqId}:
 *   get:
 *     summary: Get VP request details
 *     description: Holder retrieves details of a VP request to decide whether to share credentials
 *     tags:
 *       - Verification & Presentation (VP) Flow
 *     parameters:
 *       - in: path
 *         name: vpReqId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID of the VP request
 *     responses:
 *       200:
 *         description: VP request details retrieved successfully
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
 *                     vp_request_id:
 *                       type: string
 *                       format: uuid
 *                     verifier_did:
 *                       type: string
 *                     verifier_name:
 *                       type: string
 *                       example: PT. ABC Company
 *                     holder_did:
 *                       type: string
 *                     requested_credentials:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           schema_id:
 *                             type: string
 *                             format: uuid
 *                           schema_name:
 *                             type: string
 *                           required_fields:
 *                             type: array
 *                             items:
 *                               type: string
 *                     purpose:
 *                       type: string
 *                     status:
 *                       type: string
 *                       enum: [PENDING, FULFILLED, REJECTED, EXPIRED]
 *                     created_at:
 *                       type: string
 *                       format: date-time
 *                     expires_at:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Invalid request ID
 *       404:
 *         description: VP request not found
 *       500:
 *         description: Internal server error
 */
router.get(
  "/request/:vpReqId",
  getVPRequestDetailsValidator,
  vp.getVPRequestDetails
);

/**
 * @swagger
 * /presentations:
 *   post:
 *     summary: Store Verifiable Presentation
 *     description: Holder creates and stores a VP to share with the verifier (requires DID authentication). VP must be a signed JSON string from frontend.
 *     tags:
 *       - Verification & Presentation (VP) Flow
 *     security:
 *       - HolderBearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - vp
 *             properties:
 *               vp:
 *                 type: string
 *                 description: Signed Verifiable Presentation as JSON string
 *                 example: '{"@context":["https://www.w3.org/2018/credentials/v1"],"type":["VerifiablePresentation"],"holder":"did:dcert:holder123","verifiableCredential":[...],"proof":{"type":"DataIntegrityProof","cryptosuite":"eddsa-rdfc-2022","created":"2024-01-01T00:00:00Z","verificationMethod":"did:dcert:holder123#key-1","proofPurpose":"authentication","proofValue":"z..."}}'
 *     responses:
 *       201:
 *         description: VP stored successfully
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
 *                   example: VP stored successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     vp_id:
 *                       type: string
 *                       format: uuid
 *                       description: ID of the stored VP for QR code generation
 *       400:
 *         description: Invalid request data or invalid JSON string
 *       401:
 *         description: Unauthorized - invalid or missing JWT token
 *       500:
 *         description: Internal server error
 */
router.post("/", verifyDIDSignature, storeVPValidator, vp.storeVP);

/**
 * @swagger
 * /presentations/{vpId}:
 *   get:
 *     summary: Get Verifiable Presentation
 *     description: Verifier retrieves the stored VP from holder
 *     tags:
 *       - Verification & Presentation (VP) Flow
 *     parameters:
 *       - in: path
 *         name: vpId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID of the VP to retrieve
 *     responses:
 *       200:
 *         description: VP retrieved successfully
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
 *                     vp_id:
 *                       type: string
 *                       format: uuid
 *                     '@context':
 *                       type: string
 *                       example: https://www.w3.org/2018/credentials/v1
 *                     type:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: ["VerifiablePresentation"]
 *                     holder:
 *                       type: string
 *                       example: did:dcert:holder456
 *                     verifiableCredential:
 *                       type: array
 *                       items:
 *                         type: object
 *                         description: Disclosed credentials
 *                     proof:
 *                       type: object
 *                       properties:
 *                         type:
 *                           type: string
 *                         created:
 *                           type: string
 *                           format: date-time
 *                         proofPurpose:
 *                           type: string
 *                         verificationMethod:
 *                           type: string
 *                         signature:
 *                           type: string
 *                     created_at:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Invalid VP ID
 *       404:
 *         description: VP not found
 *       403:
 *         description: Unauthorized to access this VP
 *       500:
 *         description: Internal server error
 */
router.get("/:vpId", getVPValidator, vp.getVP);

/**
 * @swagger
 * /presentations/{vpId}/verify:
 *   get:
 *     summary: Verify Verifiable Presentation (One-Time Use)
 *     description: |
 *       Verify the authenticity and integrity of a VP and its contained VCs (requires DID authentication).
 *
 *       **One-Time Use**: After verification (regardless of valid or invalid result), the VP will be soft-deleted
 *       to prevent reuse. This ensures that each VP can only be verified once.
 *
 *       **Idempotent**: Calling this endpoint multiple times on an already-verified VP will return 404
 *       "VP not found or already verified".
 *     tags:
 *       - Verification & Presentation (VP) Flow
 *     security:
 *       - VerifierBearerAuth: []
 *     parameters:
 *       - in: path
 *         name: vpId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID of the VP to verify
 *     responses:
 *       200:
 *         description: VP verification completed (VP is now soft-deleted regardless of result)
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
 *                     vp:
 *                       type: object
 *                       description: The Verifiable Presentation
 *                     vp_valid:
 *                       type: boolean
 *                       description: Whether the VP signature is valid
 *                     holder_did:
 *                       type: string
 *                       description: DID of the holder who signed the VP
 *                     credentials_verification:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           vc_id:
 *                             type: string
 *                           issuer:
 *                             type: string
 *                           valid:
 *                             type: boolean
 *                           error:
 *                             type: string
 *       400:
 *         description: Invalid VP ID
 *       401:
 *         description: Unauthorized - invalid or missing JWT token
 *       404:
 *         description: VP not found or already verified (one-time use)
 *       500:
 *         description: Internal server error
 */
router.get("/:vpId/verify", verifyDIDSignature, verifyVPValidator, vp.verifyVP);

export default router;
