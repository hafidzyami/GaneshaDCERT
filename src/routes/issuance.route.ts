import { Router } from 'express';
import { 
  createVCIssuance,
  waitForVCIssuance
} from '../controllers/request.controller';

const router = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     VCIssuanceInput:
 *       type: object
 *       required:
 *         - holder_did
 *         - issuer_did
 *         - credential_type
 *         - credential
 *         - _replyTo
 *         - _correlationId
 *       properties:
 *         holder_did:
 *           type: string
 *           description: DID of the credential holder
 *           example: "did:example:holder456"
 *         issuer_did:
 *           type: string
 *           description: DID of the credential issuer
 *           example: "did:example:issuer123"
 *         credential_type:
 *           type: string
 *           description: Type of credential being issued
 *           example: "bachelor_degree"
 *         request_id:
 *           type: string
 *           description: Original request ID (optional)
 *           example: "req_1234567890_abc123"
 *         _replyTo:
 *           type: string
 *           description: Reply queue name from the request (Direct Reply-to)
 *           example: "reply.did:example:holder456.1234567890"
 *         _correlationId:
 *           type: string
 *           description: Correlation ID from the request (Direct Reply-to)
 *           example: "550e8400-e29b-41d4-a716-446655440000"
 *         credential:
 *           type: object
 *           description: The actual Verifiable Credential
 *           example:
 *             "@context": ["https://www.w3.org/2018/credentials/v1"]
 *             type: ["VerifiableCredential", "BachelorDegree"]
 *             issuer: "did:example:issuer123"
 *             issuanceDate: "2024-01-01T00:00:00Z"
 *             credentialSubject:
 *               id: "did:example:holder456"
 *               degree:
 *                 type: "BachelorDegree"
 *                 name: "Bachelor of Computer Science"
 *                 university: "Ganesha University"
 */

/**
 * @swagger
 * /api/issuances:
 *   post:
 *     summary: Issue a VC to holder using Direct Reply-to (Issuer → Holder)
 *     description: |
 *       Issue a Verifiable Credential to a holder using Direct Reply-to pattern.
 *       The issuer must provide **_replyTo** and **_correlationId** from the original request.
 *       Response will be sent directly to the holder's reply queue.
 *     tags: [VC Issuances]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/VCIssuanceInput'
 *           example:
 *             holder_did: "did:example:holder456"
 *             issuer_did: "did:example:issuer123"
 *             credential_type: "bachelor_degree"
 *             request_id: "req_1234567890_abc123"
 *             _replyTo: "reply.did:example:holder456.1234567890"
 *             _correlationId: "550e8400-e29b-41d4-a716-446655440000"
 *             credential:
 *               "@context": ["https://www.w3.org/2018/credentials/v1"]
 *               type: ["VerifiableCredential", "BachelorDegree"]
 *               issuer: "did:example:issuer123"
 *               issuanceDate: "2024-01-01T00:00:00Z"
 *               credentialSubject:
 *                 id: "did:example:holder456"
 *                 degree:
 *                   type: "BachelorDegree"
 *                   name: "Bachelor of Computer Science"
 *                   university: "Ganesha University"
 *                   graduation_year: 2024
 *     responses:
 *       201:
 *         description: VC issued successfully via Direct Reply-to
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
 *       400:
 *         description: Validation error (missing _replyTo or _correlationId)
 *       500:
 *         description: Server error
 */
router.post('/', createVCIssuance);

/**
 * @swagger
 * /api/issuances/wait:
 *   get:
 *     summary: Wait for VC issuance response (Holder waits for Issuer response)
 *     description: |
 *       Holder uses this endpoint to wait for VC issuance response using Direct Reply-to pattern.
 *       Provide the **replyTo** queue name and **correlationId** from the request.
 *       This endpoint will block until response is received or timeout occurs.
 *     tags: [VC Issuances]
 *     parameters:
 *       - in: query
 *         name: replyTo
 *         required: true
 *         description: Reply queue name from the request
 *         schema:
 *           type: string
 *           example: "reply.did:example:holder456.1234567890"
 *       - in: query
 *         name: correlationId
 *         required: true
 *         description: Correlation ID from the request
 *         schema:
 *           type: string
 *           example: "550e8400-e29b-41d4-a716-446655440000"
 *       - in: query
 *         name: timeout
 *         required: false
 *         description: Timeout in milliseconds (default 30000)
 *         schema:
 *           type: integer
 *           example: 30000
 *     responses:
 *       200:
 *         description: Successfully received VC issuance
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
 *                   description: The issued VC
 *       400:
 *         description: Missing required parameters
 *       408:
 *         description: Request timeout (no response received)
 *       500:
 *         description: Server error
 */
router.get('/wait', waitForVCIssuance);

export default router;
