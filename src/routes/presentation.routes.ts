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
 *     description: Verifier requests a Verifiable Presentation from a holder (requires DID authentication)
 *     tags:
 *       - Verification & Presentation (VP) Flow
 *     security:
 *       - VerifierBearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - verifier_did
 *               - verifier_name
 *               - holder_did
 *               - purpose
 *               - requested_credentials
 *             properties:
 *               verifier_did:
 *                 type: string
 *                 example: did:dcert:iVerifier123
 *                 description: DID of the verifier requesting the VP
 *               verifier_name:
 *                 type: string
 *                 example: PT. ABC Company
 *                 description: Name of the verifier organization
 *               holder_did:
 *                 type: string
 *                 example: did:dcert:uHolder456
 *                 description: DID of the holder who should provide the VP
 *               purpose:
 *                 type: string
 *                 example: Employment verification
 *                 description: Purpose of the verification request
 *               requested_credentials:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - schema_id
 *                     - schema_name
 *                     - schema_version
 *                   properties:
 *                     schema_id:
 *                       type: string
 *                       format: uuid
 *                       description: ID of the credential schema being requested
 *                       example: 550e8400-e29b-41d4-a716-446655440000
 *                     schema_name:
 *                       type: string
 *                       example: Academic Diploma
 *                       description: Name of the credential schema
 *                     schema_version:
 *                       type: number
 *                       example: 1
 *                       description: Version of the credential schema
 *                 description: List of credential schemas being requested (verifier only specifies schema, not specific VCs)
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
 *                   example: VP request created successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     vp_request_id:
 *                       type: string
 *                       format: uuid
 *                     message:
 *                       type: string
 *                       example: VP request sent successfully. Awaiting Holder's response.
 *       400:
 *         description: Invalid request data
 *       401:
 *         description: Unauthorized - invalid or missing JWT token
 *       500:
 *         description: Internal server error
 */
router.post("/request", verifyDIDSignature, requestVPValidator, vp.requestVP);

/**
 * @swagger
 * /presentations/request:
 *   get:
 *     summary: Get VP requests with filtering
 *     description: Get VP requests filtered by verifier_did OR holder_did, and optionally by status
 *     tags:
 *       - Verification & Presentation (VP) Flow
 *     parameters:
 *       - in: query
 *         name: verifier_did
 *         schema:
 *           type: string
 *         description: Filter by verifier DID (to see requests made by verifier)
 *       - in: query
 *         name: holder_did
 *         schema:
 *           type: string
 *         description: Filter by holder DID (to see requests made to holder)
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, ACCEPT, DECLINE]
 *         description: Optional filter by request status
 *     responses:
 *       200:
 *         description: VP requests retrieved successfully
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
 *                     requests:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             format: uuid
 *                           holder_did:
 *                             type: string
 *                           verifier_did:
 *                             type: string
 *                           verifier_name:
 *                             type: string
 *                           purpose:
 *                             type: string
 *                           status:
 *                             type: string
 *                             enum: [PENDING, ACCEPT, DECLINE]
 *                           requested_credentials:
 *                             type: array
 *                             description: List of credentials requested by verifier
 *                             items:
 *                               type: object
 *                               properties:
 *                                 schema_id:
 *                                   type: string
 *                                   format: uuid
 *                                   description: Schema ID
 *                                 schema_name:
 *                                   type: string
 *                                   description: Schema name
 *                                 schema_version:
 *                                   type: integer
 *                                   description: Schema version
 *                           vp_id:
 *                             type: string
 *                             nullable: true
 *                           verify_status:
 *                             type: string
 *                             enum: [NOT_VERIFIED, VALID_VERIFICATION, INVALID_VERIFICATION]
 *                           createdAt:
 *                             type: string
 *                             format: date-time
 *                           updatedAt:
 *                             type: string
 *                             format: date-time
 *       400:
 *         description: Invalid request - must provide either verifier_did or holder_did
 *       500:
 *         description: Internal server error
 */
router.get("/request", vp.getVPRequests);

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
 *               is_barcode:
 *                 type: boolean
 *                 description: Indicates whether the VP sharing is from a barcode scan (optional, defaults to false)
 *                 example: true
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
 * /presentations/accept:
 *   post:
 *     summary: Accept VP Request
 *     description: Holder accepts a VP request and provides the VP ID
 *     tags:
 *       - Verification & Presentation (VP) Flow
 *     parameters:
 *       - in: query
 *         name: vpReqId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID of the VP request to accept
 *       - in: query
 *         name: vpId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID of the VP created for this request
 *     responses:
 *       200:
 *         description: VP request accepted successfully
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
 *                   example: VP request accepted successfully
 *       400:
 *         description: Invalid request parameters
 *       404:
 *         description: VP request not found
 *       500:
 *         description: Internal server error
 */
router.post("/accept", vp.acceptVPRequest);

/**
 * @swagger
 * /presentations/decline:
 *   post:
 *     summary: Decline VP Request
 *     description: Holder declines a VP request
 *     tags:
 *       - Verification & Presentation (VP) Flow
 *     parameters:
 *       - in: query
 *         name: vpReqId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID of the VP request to decline
 *     responses:
 *       200:
 *         description: VP request declined successfully
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
 *                   example: VP request declined successfully
 *       400:
 *         description: Invalid request parameters
 *       404:
 *         description: VP request not found
 *       500:
 *         description: Internal server error
 */
router.post("/decline", vp.declineVPRequest);

/**
 * @swagger
 * /presentations/claim:
 *   post:
 *     summary: Claim VPs by Verifier
 *     description: Verifier claims all pending VPs that were created for their requests (initiated by verifier flow)
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
 *             properties:
 *               verifier_did:
 *                 type: string
 *                 example: did:dcert:iVerifier123
 *                 description: DID of the verifier claiming VPs
 *     responses:
 *       200:
 *         description: VPs claimed successfully
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
 *                   example: VPs claimed successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     vp_sharings:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           vp_id:
 *                             type: string
 *                             format: uuid
 *                           holder_did:
 *                             type: string
 *                           vp:
 *                             type: object
 *                             description: The Verifiable Presentation
 *                           created_at:
 *                             type: string
 *                             format: date-time
 *       400:
 *         description: Invalid request data
 *       500:
 *         description: Internal server error
 */
router.post("/claim", vp.claimVP);

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
 *     summary: Verify Verifiable Presentation
 *     description: |
 *       Verify the authenticity and integrity of a VP and its contained VCs (requires DID authentication).
 *
 *       **Conditional Behavior based on is_barcode**:
 *       - **is_barcode = false**: One-time use VP. After verification (regardless of valid or invalid result),
 *         the VP will be soft-deleted to prevent reuse. Calling this endpoint again will return 404
 *         "VP not found or already verified".
 *       - **is_barcode = true**: Reusable VP for barcode scanning scenarios. The VP will never be deleted
 *         and can be verified multiple times.
 *
 *       This allows barcode-based VPs to be scanned and verified repeatedly while maintaining
 *       security for traditional one-time VP sharing.
 *     tags:
 *       - Verification & Presentation (VP) Flow
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
 *         description: VP verification completed (one-time VPs are soft-deleted, barcode VPs remain reusable)
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
 *         description: VP not found, or already verified and deleted (for one-time use VPs only)
 *       500:
 *         description: Internal server error
 */
router.get("/:vpId/verify", verifyVPValidator, vp.verifyVP);

export default router;
