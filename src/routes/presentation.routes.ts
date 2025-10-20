import express, { Router } from "express";
import * as vp from "../controllers/presentation.controller";
import {
  requestVPValidator,
  getVPRequestDetailsValidator,
  storeVPValidator,
  getVPValidator,
} from "../validators/presentation.validator";

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
 *                 example: did:ganesha:0xverifier123
 *                 description: DID of the verifier requesting the VP
 *               holder_did:
 *                 type: string
 *                 example: did:ganesha:0xholder456
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
router.get("/request/:vpReqId", getVPRequestDetailsValidator, vp.getVPRequestDetails);

/**
 * @swagger
 * /presentations:
 *   post:
 *     summary: Store Verifiable Presentation
 *     description: Holder creates and stores a VP to share with the verifier
 *     tags:
 *       - Verification & Presentation (VP) Flow
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - vp_request_id
 *               - credentials
 *             properties:
 *               vp_request_id:
 *                 type: string
 *                 format: uuid
 *                 description: ID of the VP request being fulfilled
 *               credentials:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     vc_id:
 *                       type: string
 *                       format: uuid
 *                       description: ID of the credential to include
 *                     disclosed_fields:
 *                       type: array
 *                       items:
 *                         type: string
 *                       description: Fields to disclose from this credential
 *                 description: Credentials to include in the VP
 *               holder_signature:
 *                 type: string
 *                 description: Digital signature from holder
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
 *                   example: VP berhasil dibuat dan disimpan
 *                 data:
 *                   type: object
 *                   properties:
 *                     vp_id:
 *                       type: string
 *                       format: uuid
 *                     vp_request_id:
 *                       type: string
 *                       format: uuid
 *                     status:
 *                       type: string
 *                       example: SHARED
 *       400:
 *         description: Invalid request data or missing credentials
 *       404:
 *         description: VP request or credentials not found
 *       500:
 *         description: Internal server error
 */
router.post("/", storeVPValidator, vp.storeVP);

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
 *                       example: did:ganesha:0xholder456
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

export default router;
