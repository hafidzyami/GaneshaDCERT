import { Router } from 'express';
import { 
  createVCIssuance,
  getVCIssuancesByHolder
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
 *       properties:
 *         holder_did:
 *           type: string
 *           description: DID of the credential holder (routing key)
 *           example: "did:example:holder456"
 *         issuer_did:
 *           type: string
 *           description: DID of the credential issuer
 *           example: "did:example:issuer123"
 *         credential_type:
 *           type: string
 *           description: Type of credential being issued
 *           example: "bachelor_degree"
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
 *     summary: Issue a VC to holder (Issuer → Holder)
 *     description: |
 *       Issue a Verifiable Credential to a holder.
 *       Message will be stored in RabbitMQ queue with **holder_did as routing key**.
 *       **NO TTL** - Message stays until holder retrieves it.
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
 *         description: VC issued successfully
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
 *         description: Validation error
 *       500:
 *         description: Server error
 */
router.post('/', createVCIssuance);

/**
 * @swagger
 * /api/issuances:
 *   get:
 *     summary: Get all VCs for a holder (TRIGGERS 5-MINUTE DELETION)
 *     description: |
 *       Retrieve all Verifiable Credentials issued to a holder.
 *       **IMPORTANT**: After successful retrieval (200 OK), all messages will be 
 *       **automatically deleted after 5 minutes**.
 *     tags: [VC Issuances]
 *     parameters:
 *       - in: query
 *         name: holder_did
 *         required: true
 *         description: DID of the holder
 *         schema:
 *           type: string
 *           example: "did:example:holder456"
 *     responses:
 *       200:
 *         description: Successfully retrieved credentials (5-min deletion timer started)
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
 *                     holder_did:
 *                       type: string
 *                     total_credentials:
 *                       type: number
 *                     credentials:
 *                       type: array
 *                     deletion_note:
 *                       type: string
 *                       description: Note about 5-minute deletion
 *       400:
 *         description: Missing holder_did parameter
 *       500:
 *         description: Server error
 */
router.get('/', getVCIssuancesByHolder);

export default router;
