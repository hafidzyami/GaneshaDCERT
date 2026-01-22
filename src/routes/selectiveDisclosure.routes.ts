import express, { Router } from "express";
import * as sd from "../controllers/selectiveDisclosure.controller";
import {
  createSelectiveDisclosureRequestValidator,
  getSelectiveDisclosureRequestValidator,
  getPendingRequestsValidator,
  submitSelectiveDisclosureVPValidator,
  getVerificationResultValidator,
  declineSelectiveDisclosureRequestValidator,
} from "../validators/selectiveDisclosure.validator";
import { verifyDIDSignature } from "../middlewares/didAuth.middleware";

const router: Router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Selective Disclosure (ZKP)
 *   description: Zero-Knowledge Proof based selective disclosure for Verifiable Presentations. Allows holders to prove credential ownership and attribute conditions without revealing all data.
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     PredicateOperator:
 *       type: string
 *       enum: ['>', '<', '>=', '<=', '==', '!=']
 *       description: Comparison operator for predicate proofs
 *
 *     PredicateCondition:
 *       type: object
 *       properties:
 *         operator:
 *           $ref: '#/components/schemas/PredicateOperator'
 *         value:
 *           oneOf:
 *             - type: string
 *             - type: number
 *           description: Value to compare against
 *
 *     RequestedAttribute:
 *       type: object
 *       properties:
 *         attributePath:
 *           type: string
 *           example: credentialSubject.dateOfBirth
 *           description: JSON path to the attribute in the credential
 *         required:
 *           type: boolean
 *           description: Whether this attribute is required
 *         acceptPredicate:
 *           type: boolean
 *           description: If true, accept a predicate proof instead of revealed value
 *
 *     RequestedPredicate:
 *       type: object
 *       properties:
 *         attributePath:
 *           type: string
 *           example: credentialSubject.age
 *           description: JSON path to the attribute
 *         operator:
 *           $ref: '#/components/schemas/PredicateOperator'
 *         value:
 *           oneOf:
 *             - type: string
 *             - type: number
 *           description: Value to compare against
 *         required:
 *           type: boolean
 *           description: Whether this predicate is required
 *
 *     SelectiveDisclosureRequest:
 *       type: object
 *       properties:
 *         requestId:
 *           type: string
 *           format: uuid
 *         verifierDID:
 *           type: string
 *           example: did:dcert:iVerifier123
 *         holderDID:
 *           type: string
 *           example: did:dcert:uHolder456
 *         credentialTypes:
 *           type: array
 *           items:
 *             type: string
 *         purpose:
 *           type: string
 *         challenge:
 *           type: string
 *           description: Random challenge for replay protection
 *         domain:
 *           type: string
 *           description: Domain for replay protection
 *         expiresAt:
 *           type: string
 *           format: date-time
 *         requestedAttributes:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/RequestedAttribute'
 *         requestedPredicates:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/RequestedPredicate'
 *
 *     VerificationChecks:
 *       type: object
 *       properties:
 *         bbsProofValid:
 *           type: boolean
 *           description: BBS+ derived proof is valid
 *         issuerTrusted:
 *           type: boolean
 *           description: Issuer is trusted/registered
 *         credentialNotRevoked:
 *           type: boolean
 *           description: Credential not revoked on blockchain
 *         credentialNotExpired:
 *           type: boolean
 *           description: Credential not expired
 *         challengeMatches:
 *           type: boolean
 *           description: Challenge matches request (replay protection)
 *         domainMatches:
 *           type: boolean
 *           description: Domain matches request
 *         predicatesValid:
 *           type: boolean
 *           description: All predicate proofs valid
 *         requiredAttributesPresent:
 *           type: boolean
 *           description: All required attributes present
 *
 *     RevealedAttribute:
 *       type: object
 *       properties:
 *         path:
 *           type: string
 *           example: credentialSubject.name
 *         name:
 *           type: string
 *           example: name
 *         value:
 *           type: any
 *         credentialIndex:
 *           type: integer
 *
 *     PredicateProofResult:
 *       type: object
 *       properties:
 *         attributePath:
 *           type: string
 *         attributeName:
 *           type: string
 *         predicate:
 *           $ref: '#/components/schemas/PredicateCondition'
 *         satisfied:
 *           type: boolean
 *         proofValue:
 *           type: string
 *
 *     SelectiveDisclosureVerificationResult:
 *       type: object
 *       properties:
 *         valid:
 *           type: boolean
 *           description: Overall verification status
 *         checks:
 *           $ref: '#/components/schemas/VerificationChecks'
 *         revealedAttributes:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/RevealedAttribute'
 *         predicateResults:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/PredicateProofResult'
 *         issuer:
 *           type: string
 *         holder:
 *           type: string
 *         errors:
 *           type: array
 *           items:
 *             type: string
 */

/**
 * @swagger
 * /presentations/selective/request:
 *   post:
 *     summary: Create Selective Disclosure Request
 *     description: |
 *       Verifier creates a selective disclosure request specifying:
 *       - Which credential types are needed
 *       - Which attributes should be revealed
 *       - Which predicates should be proven (e.g., age >= 18)
 *
 *       The holder will receive a challenge to include in their BBS+ proof.
 *     tags:
 *       - Selective Disclosure (ZKP)
 *     security:
 *       - VerifierBearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - holderDID
 *               - verifierDID
 *               - verifierName
 *               - credentialTypes
 *               - purpose
 *               - domain
 *             properties:
 *               holderDID:
 *                 type: string
 *                 example: did:dcert:uHolder456
 *                 description: DID of the holder
 *               verifierDID:
 *                 type: string
 *                 example: did:dcert:iVerifier123
 *                 description: DID of the verifier
 *               verifierName:
 *                 type: string
 *                 example: PT. ABC Company
 *                 description: Name of the verifier organization
 *               credentialTypes:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["UniversityDegree", "EmploymentCredential"]
 *                 description: Types of credentials requested
 *               purpose:
 *                 type: string
 *                 example: Age verification for alcohol purchase
 *                 description: Purpose of the verification
 *               domain:
 *                 type: string
 *                 example: example.com
 *                 description: Domain for replay protection
 *               expiresIn:
 *                 type: integer
 *                 example: 900
 *                 description: Expiration time in seconds (60-3600, default 900)
 *               requestedAttributes:
 *                 type: array
 *                 items:
 *                   $ref: '#/components/schemas/RequestedAttribute'
 *                 description: Specific attributes to reveal
 *               requestedPredicates:
 *                 type: array
 *                 items:
 *                   $ref: '#/components/schemas/RequestedPredicate'
 *                 example:
 *                   - attributePath: credentialSubject.age
 *                     operator: '>='
 *                     value: 18
 *                     required: true
 *                 description: Predicates to prove (e.g., age >= 18)
 *     responses:
 *       201:
 *         description: Request created successfully
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
 *                   example: Selective disclosure request created successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     requestId:
 *                       type: string
 *                       format: uuid
 *                     challenge:
 *                       type: string
 *                       description: Challenge to include in BBS+ proof
 *                     domain:
 *                       type: string
 *                     expiresAt:
 *                       type: string
 *                       format: date-time
 *                     status:
 *                       type: string
 *                       enum: [PENDING]
 *       400:
 *         description: Invalid request data or DID not found
 *       401:
 *         description: Unauthorized
 */
router.post(
  "/request",
  verifyDIDSignature,
  createSelectiveDisclosureRequestValidator,
  sd.createSelectiveDisclosureRequest
);

/**
 * @swagger
 * /presentations/selective/request/{requestId}:
 *   get:
 *     summary: Get Selective Disclosure Request Details
 *     description: Get details of a specific selective disclosure request including challenge and required attributes/predicates
 *     tags:
 *       - Selective Disclosure (ZKP)
 *     security:
 *       - HolderBearerAuth: []
 *     parameters:
 *       - in: path
 *         name: requestId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The request ID
 *     responses:
 *       200:
 *         description: Request details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/SelectiveDisclosureRequest'
 *       400:
 *         description: Request expired
 *       404:
 *         description: Request not found
 */
router.get(
  "/request/:requestId",
  verifyDIDSignature,
  getSelectiveDisclosureRequestValidator,
  sd.getSelectiveDisclosureRequest
);

/**
 * @swagger
 * /presentations/selective/requests:
 *   get:
 *     summary: Get Pending Selective Disclosure Requests
 *     description: Get all pending selective disclosure requests for a holder
 *     tags:
 *       - Selective Disclosure (ZKP)
 *     security:
 *       - HolderBearerAuth: []
 *     parameters:
 *       - in: query
 *         name: holder_did
 *         schema:
 *           type: string
 *         description: Holder DID (optional if authenticated)
 *     responses:
 *       200:
 *         description: Pending requests retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     requests:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/SelectiveDisclosureRequest'
 */
router.get(
  "/requests",
  verifyDIDSignature,
  getPendingRequestsValidator,
  sd.getPendingSelectiveDisclosureRequests
);

/**
 * @swagger
 * /presentations/selective:
 *   post:
 *     summary: Submit Selective Disclosure VP
 *     description: |
 *       Holder submits a Verifiable Presentation with BBS+ selective disclosure proof.
 *
 *       The VP contains:
 *       - Only revealed attributes (hidden attributes not included)
 *       - Predicate proofs for conditions (e.g., proves age >= 18 without revealing actual age)
 *       - BBS+ derived proof
 *
 *       **Important:** The backend NEVER sees hidden attribute values.
 *       Verification is done cryptographically without revealing data.
 *     tags:
 *       - Selective Disclosure (ZKP)
 *     security:
 *       - HolderBearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - requestId
 *               - selectiveVP
 *             properties:
 *               requestId:
 *                 type: string
 *                 format: uuid
 *                 description: The request ID to respond to
 *               selectiveVP:
 *                 type: string
 *                 description: JSON stringified SelectiveDisclosureVP
 *                 example: '{"@context":["https://www.w3.org/2018/credentials/v1"],"type":["VerifiablePresentation","SelectiveDisclosurePresentation"],"holder":"did:dcert:uHolder456","verifiableCredential":[...],"proof":{"type":"BBS+SelectiveDisclosure2023","challenge":"abc123","domain":"example.com","proofValue":"z..."}}'
 *     responses:
 *       200:
 *         description: VP verified (check valid field for result)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   $ref: '#/components/schemas/SelectiveDisclosureVerificationResult'
 *       400:
 *         description: Invalid VP format or request expired
 *       404:
 *         description: Request not found
 */
router.post(
  "/",
  verifyDIDSignature,
  submitSelectiveDisclosureVPValidator,
  sd.submitSelectiveDisclosureVP
);

/**
 * @swagger
 * /presentations/selective/{vpId}/verify:
 *   get:
 *     summary: Get VP Verification Result
 *     description: Get the verification result for a previously submitted selective disclosure VP
 *     tags:
 *       - Selective Disclosure (ZKP)
 *     security:
 *       - VerifierBearerAuth: []
 *     parameters:
 *       - in: path
 *         name: vpId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The VP ID
 *     responses:
 *       200:
 *         description: Verification result retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/SelectiveDisclosureVerificationResult'
 *       404:
 *         description: VP not found
 */
router.get(
  "/:vpId/verify",
  verifyDIDSignature,
  getVerificationResultValidator,
  sd.getVerificationResult
);

/**
 * @swagger
 * /presentations/selective/request/{requestId}/decline:
 *   post:
 *     summary: Decline Selective Disclosure Request
 *     description: Holder declines a selective disclosure request
 *     tags:
 *       - Selective Disclosure (ZKP)
 *     security:
 *       - HolderBearerAuth: []
 *     parameters:
 *       - in: path
 *         name: requestId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The request ID to decline
 *     responses:
 *       200:
 *         description: Request declined successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     requestId:
 *                       type: string
 *                     status:
 *                       type: string
 *                       example: DECLINE
 *       404:
 *         description: Request not found
 */
router.post(
  "/request/:requestId/decline",
  verifyDIDSignature,
  declineSelectiveDisclosureRequestValidator,
  sd.declineSelectiveDisclosureRequest
);

export default router;
