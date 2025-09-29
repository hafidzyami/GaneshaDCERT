import { Router } from 'express';
import { 
  createVCIssuance,
  getVCIssuancesByHolder
} from '../controllers/request.controller';

const router = Router();

/**
 * @swagger
 * /api/issuances:
 *   post:
 *     summary: Issue a VC to holder (Issuer → Holder)
 *     description: |
 *       Issue a Verifiable Credential to a holder.
 *       Message will be sent to Kafka topic 'vc_issuances' with **holder_did as partition key**.
 *     tags: [VC Issuances]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       201:
 *         description: VC issued successfully
 */
router.post('/', createVCIssuance);

/**
 * @swagger
 * /api/issuances:
 *   get:
 *     summary: Get all VCs for a holder
 *     tags: [VC Issuances]
 *     parameters:
 *       - in: query
 *         name: holder_did
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Successfully retrieved credentials
 */
router.get('/', getVCIssuancesByHolder);

export default router;
