import { Router } from 'express';
import { 
  createVCRequest, 
  getVCRequestsByIssuer
} from '../controllers/request.controller';

const router = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     VCRequestInput:
 *       type: object
 *       required:
 *         - issuer_did
 *         - holder_did
 *         - credential_type
 *       properties:
 *         issuer_did:
 *           type: string
 *           description: DID of the credential issuer (used as partition key)
 *           example: "did:example:issuer123"
 *         holder_did:
 *           type: string
 *           description: DID of the credential holder
 *           example: "did:example:holder456"
 *         credential_type:
 *           type: string
 *           description: Type of credential being requested
 *           example: "bachelor_degree"
 *         credential_data:
 *           type: object
 *           description: Additional data for the credential
 *   
 *   tags:
 *     - name: VC Requests
 *       description: Verifiable Credential request management (Holder → Issuer)
 *     - name: VC Issuances
 *       description: Verifiable Credential issuance management (Issuer → Holder)
 */

/**
 * @swagger
 * /api/requests:
 *   post:
 *     summary: Create a new VC request (Holder → Issuer)
 *     description: |
 *       Submit a new Verifiable Credential request.
 *       Message will be sent to Kafka topic 'vc_requests' with **issuer_did as partition key**.
 *       
 *       **Kafka Partitioning:**
 *       - Key: issuer_did
 *       - All requests for the same issuer go to the same partition
 *       - Issuer can query their partition to see all incoming requests
 *     tags: [VC Requests]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/VCRequestInput'
 *     responses:
 *       201:
 *         description: VC Request submitted successfully
 *       400:
 *         description: Validation failed
 *       500:
 *         description: Internal server error
 */
router.post('/', createVCRequest);

/**
 * @swagger
 * /api/requests:
 *   get:
 *     summary: Get all VC requests for an issuer
 *     description: |
 *       Retrieve all VC requests for a specific issuer by consuming from their Kafka partition.
 *       
 *       **Query Process:**
 *       1. Consume from topic 'vc_requests'
 *       2. Filter messages where key = issuer_did
 *       3. Return all matching requests
 *     tags: [VC Requests]
 *     parameters:
 *       - in: query
 *         name: issuer_did
 *         required: true
 *         description: DID of the issuer
 *         schema:
 *           type: string
 *           example: "did:example:issuer123"
 *     responses:
 *       200:
 *         description: Successfully retrieved requests
 *       400:
 *         description: Missing issuer_did parameter
 *       500:
 *         description: Internal server error
 */
router.get('/', getVCRequestsByIssuer);

export default router;
