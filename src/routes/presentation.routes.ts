import express, { Router } from "express";
import * as vp from "../controllers/presentation.controller";
import {
  requestVPValidator,
  requestIdParamValidator,
  acceptRequestByIdValidator,
  storeVPValidator,
  getVPValidator,
  verifyVPValidator,
  confirmVPValidator,
  deleteVPValidator,
} from "../validators/presentation.validator";
import { verifyDIDSignature } from "../middlewares/didAuth.middleware";

const router: Router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Verification & Presentation (VP) Flow
 *   description: Unified Verifiable Presentation request and sharing endpoints (full + selective disclosure)
 */

// ============================================
// REQUEST FLOW (unified: full + selective)
// ============================================

/**
 * @swagger
 * /presentations/request:
 *   post:
 *     summary: Create VP Request (full or selective)
 *     description: |
 *       Verifier creates a VP request. Use `mode: "full"` for traditional VP flow
 *       or `mode: "selective"` for ZKP-based selective disclosure.
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
 *               - mode
 *               - holder_did
 *               - verifier_did
 *               - verifier_name
 *               - purpose
 *             properties:
 *               mode:
 *                 type: string
 *                 enum: [full, selective]
 *                 description: Request mode
 *               holder_did:
 *                 type: string
 *                 example: did:dcert:uHolder456
 *               verifier_did:
 *                 type: string
 *                 example: did:dcert:iVerifier123
 *               verifier_name:
 *                 type: string
 *                 example: PT. ABC Company
 *               purpose:
 *                 type: string
 *                 example: Employment verification
 *               requested_credentials:
 *                 type: array
 *                 description: (full mode only) Credential schemas requested
 *                 items:
 *                   type: object
 *                   properties:
 *                     schema_id:
 *                       type: string
 *                       format: uuid
 *                     schema_name:
 *                       type: string
 *                     schema_version:
 *                       type: number
 *               credential_types:
 *                 type: array
 *                 description: (selective mode only) Credential types requested
 *                 items:
 *                   type: string
 *               domain:
 *                 type: string
 *                 description: (selective mode only) Domain for replay protection
 *               expires_in:
 *                 type: integer
 *                 description: (selective mode only) Expiration in seconds (60-3600)
 *               requested_attributes:
 *                 type: array
 *                 description: (selective mode only) Attributes to reveal
 *                 items:
 *                   type: object
 *                   properties:
 *                     attribute_path:
 *                       type: string
 *                     attribute_name:
 *                       type: string
 *                     required:
 *                       type: boolean
 *                     accept_predicate:
 *                       type: boolean
 *               requested_predicates:
 *                 type: array
 *                 description: (selective mode only) Predicates to prove
 *                 items:
 *                   type: object
 *                   properties:
 *                     attribute_path:
 *                       type: string
 *                     attribute_name:
 *                       type: string
 *                     operator:
 *                       type: string
 *                       enum: ['>', '<', '>=', '<=', '==', '!=']
 *                     value:
 *                       oneOf:
 *                         - type: string
 *                         - type: number
 *                     required:
 *                       type: boolean
 *     responses:
 *       201:
 *         description: VP request created successfully
 *       400:
 *         description: Invalid request data
 *       401:
 *         description: Unauthorized
 */
router.post("/request", verifyDIDSignature, requestVPValidator, vp.requestVP);

/**
 * @swagger
 * /presentations/request:
 *   get:
 *     summary: List VP requests
 *     description: Get VP requests filtered by verifier_did OR holder_did, optionally by status and mode
 *     tags:
 *       - Verification & Presentation (VP) Flow
 *     security:
 *       - VerifierBearerAuth: []
 *       - HolderBearerAuth: []
 *     parameters:
 *       - in: query
 *         name: verifier_did
 *         schema:
 *           type: string
 *       - in: query
 *         name: holder_did
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, ACCEPT, DECLINE, EXPIRED]
 *       - in: query
 *         name: mode
 *         schema:
 *           type: string
 *           enum: [full, selective]
 *         description: Filter by mode (omit for both)
 *     responses:
 *       200:
 *         description: VP requests retrieved successfully
 *       400:
 *         description: Must provide verifier_did or holder_did
 *       401:
 *         description: Unauthorized
 */
router.get("/request", verifyDIDSignature, vp.getVPRequests);

/**
 * @swagger
 * /presentations/request/{id}:
 *   get:
 *     summary: Get VP request details
 *     description: Get details of a VP request by ID (auto-detects mode)
 *     tags:
 *       - Verification & Presentation (VP) Flow
 *     security:
 *       - HolderBearerAuth: []
 *       - VerifierBearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Request details retrieved
 *       404:
 *         description: Request not found
 */
router.get("/request/:id", verifyDIDSignature, requestIdParamValidator, vp.getVPRequestDetails);

/**
 * @swagger
 * /presentations/request/{id}/accept:
 *   post:
 *     summary: Accept VP request
 *     description: |
 *       Holder accepts a VP request. For full mode, provide `vp_id` and `credentials`.
 *       For selective mode, provide `selective_vp` (JSON stringified VP).
 *     tags:
 *       - Verification & Presentation (VP) Flow
 *     security:
 *       - HolderBearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               vp_id:
 *                 type: string
 *                 format: uuid
 *                 description: (full mode) VP ID
 *               credentials:
 *                 type: array
 *                 description: (full mode) Credentials being shared
 *                 items:
 *                   type: object
 *                   properties:
 *                     schema_id:
 *                       type: string
 *                     schema_name:
 *                       type: string
 *                     schema_version:
 *                       type: integer
 *               selective_vp:
 *                 type: string
 *                 description: (selective mode) JSON stringified SelectiveDisclosureVP
 *     responses:
 *       200:
 *         description: Request accepted
 *       400:
 *         description: Invalid request
 *       404:
 *         description: Request not found
 */
router.post("/request/:id/accept", verifyDIDSignature, acceptRequestByIdValidator, vp.acceptVPRequest);

/**
 * @swagger
 * /presentations/request/{id}/decline:
 *   post:
 *     summary: Decline VP request
 *     description: Holder declines a VP request (auto-detects mode)
 *     tags:
 *       - Verification & Presentation (VP) Flow
 *     security:
 *       - HolderBearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Request declined
 *       404:
 *         description: Request not found
 */
router.post("/request/:id/decline", verifyDIDSignature, requestIdParamValidator, vp.declineVPRequest);

/**
 * @swagger
 * /presentations/request/{id}/status:
 *   get:
 *     summary: Get request status
 *     description: Verifier polls for the current status of a VP request
 *     tags:
 *       - Verification & Presentation (VP) Flow
 *     security:
 *       - VerifierBearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Current status
 *       404:
 *         description: Request not found
 */
router.get("/request/:id/status", verifyDIDSignature, requestIdParamValidator, vp.getRequestStatus);

/**
 * @swagger
 * /presentations/request/{id}/result:
 *   get:
 *     summary: Get verification result
 *     description: Verifier gets the verification result after holder submits VP
 *     tags:
 *       - Verification & Presentation (VP) Flow
 *     security:
 *       - VerifierBearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Verification result
 *       404:
 *         description: Request not found
 */
router.get("/request/:id/result", verifyDIDSignature, requestIdParamValidator, vp.getRequestResult);

/**
 * @swagger
 * /presentations/request/{id}/cancel:
 *   post:
 *     summary: Cancel VP request
 *     description: Verifier cancels a pending VP request
 *     tags:
 *       - Verification & Presentation (VP) Flow
 *     security:
 *       - VerifierBearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Request cancelled
 *       404:
 *         description: Request not found
 */
router.post("/request/:id/cancel", verifyDIDSignature, requestIdParamValidator, vp.cancelRequest);

// ============================================
// QR/BARCODE FLOW (unchanged)
// ============================================

/**
 * @swagger
 * /presentations:
 *   post:
 *     summary: Store Verifiable Presentation
 *     description: Holder stores a VP for QR/barcode sharing
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
 *                 description: Signed VP as JSON string
 *               is_barcode:
 *                 type: boolean
 *                 description: Whether VP is for barcode scanning (reusable)
 *     responses:
 *       201:
 *         description: VP stored successfully
 */
router.post("/", verifyDIDSignature, storeVPValidator, vp.storeVP);

/**
 * @swagger
 * /presentations/claim:
 *   post:
 *     summary: Claim VPs by Verifier (Phase 1)
 *     description: Verifier claims pending VPs created for their requests
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
 *             properties:
 *               verifier_did:
 *                 type: string
 *     responses:
 *       200:
 *         description: VPs claimed successfully
 */
router.post("/claim", verifyDIDSignature, vp.claimVP);

/**
 * @swagger
 * /presentations/confirm:
 *   post:
 *     summary: Confirm VPs saved (Phase 2)
 *     description: Verifier confirms VPs have been saved to local storage
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
 *               - vp_ids
 *             properties:
 *               verifier_did:
 *                 type: string
 *               vp_ids:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: uuid
 *     responses:
 *       200:
 *         description: VPs confirmed successfully
 */
router.post("/confirm", verifyDIDSignature, confirmVPValidator, vp.confirmVP);

/**
 * @swagger
 * /presentations/{vpId}:
 *   get:
 *     summary: Get Verifiable Presentation
 *     description: Retrieve a stored VP by ID
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
 *     responses:
 *       200:
 *         description: VP retrieved
 *       404:
 *         description: VP not found
 */
router.get("/:vpId", verifyDIDSignature, getVPValidator, vp.getVP);

/**
 * @swagger
 * /presentations/{vpId}/verify:
 *   get:
 *     summary: Verify Verifiable Presentation
 *     description: |
 *       Verify VP authenticity. One-time VPs are soft-deleted after verification.
 *       Barcode VPs remain reusable.
 *     tags:
 *       - Verification & Presentation (VP) Flow
 *     parameters:
 *       - in: path
 *         name: vpId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: VP verification completed
 *       404:
 *         description: VP not found
 */
router.get("/:vpId/verify", verifyVPValidator, vp.verifyVP);

/**
 * @swagger
 * /presentations/{vpId}:
 *   delete:
 *     summary: Delete VP (Soft Delete)
 *     description: Holder soft deletes their stored VP
 *     tags:
 *       - Verification & Presentation (VP) Flow
 *     security:
 *       - HolderBearerAuth: []
 *     parameters:
 *       - in: path
 *         name: vpId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: VP deleted
 *       404:
 *         description: VP not found
 */
router.delete("/:vpId", verifyDIDSignature, deleteVPValidator, vp.deleteVP);

export default router;
