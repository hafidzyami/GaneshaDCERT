import { Router } from "express";
import * as performanceController from "../controllers/performance.controller";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Performance Testing
 *   description: Endpoints for benchmarking database vs blockchain performance
 */

/**
 * @swagger
 * /performance/schemas/database:
 *   get:
 *     summary: Get all schemas from database (Performance Testing)
 *     description: |
 *       Fetch all schemas directly from PostgreSQL database.
 *       Returns response time in milliseconds for performance comparison.
 *     tags:
 *       - Performance Testing
 *     responses:
 *       200:
 *         description: All schemas retrieved successfully with response time
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 source:
 *                   type: string
 *                   example: "database"
 *                 responseTime:
 *                   type: string
 *                   example: "25ms"
 *                 count:
 *                   type: integer
 *                   example: 100
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         example: "did:dcert:schema:diploma_certificate"
 *                       name:
 *                         type: string
 *                         example: "Diploma Certificate"
 *                       schema:
 *                         type: string
 *                         example: "{\"type\":\"object\"}"
 *                       issuer_did:
 *                         type: string
 *                         example: "did:dcert:iABCD1234567890"
 *                       version:
 *                         type: integer
 *                         example: 1
 *       500:
 *         description: Internal server error
 */
router.get("/schemas/database", performanceController.getAllSchemasFromDatabase);

/**
 * @swagger
 * /performance/schemas/blockchain:
 *   get:
 *     summary: Get all schemas from blockchain (Performance Testing)
 *     description: |
 *       Fetch all schemas directly from Besu blockchain.
 *       Returns response time in milliseconds for performance comparison.
 *     tags:
 *       - Performance Testing
 *     responses:
 *       200:
 *         description: All schemas retrieved successfully with response time
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 source:
 *                   type: string
 *                   example: "blockchain"
 *                 responseTime:
 *                   type: string
 *                   example: "150ms"
 *                 count:
 *                   type: integer
 *                   example: 100
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         example: "did:dcert:schema:diploma_certificate"
 *                       name:
 *                         type: string
 *                         example: "Diploma Certificate"
 *                       schema:
 *                         type: string
 *                         example: "{\"type\":\"object\"}"
 *                       issuerDID:
 *                         type: string
 *                         example: "did:dcert:iABCD1234567890"
 *                       version:
 *                         type: integer
 *                         example: 1
 *       500:
 *         description: Internal server error
 */
router.get("/schemas/blockchain", performanceController.getAllSchemasFromBlockchain);

/**
 * @swagger
 * /performance/schemas/database/{schemaId}/{version}:
 *   get:
 *     summary: Get specific schema from database (Performance Testing)
 *     description: |
 *       Fetch a specific schema by ID and version from PostgreSQL database.
 *       Returns response time in milliseconds for performance comparison.
 *     tags:
 *       - Performance Testing
 *     parameters:
 *       - in: path
 *         name: schemaId
 *         required: true
 *         schema:
 *           type: string
 *         description: Schema ID
 *         example: "did:dcert:schema:diploma_certificate"
 *       - in: path
 *         name: version
 *         required: true
 *         schema:
 *           type: integer
 *         description: Schema version number
 *         example: 1
 *     responses:
 *       200:
 *         description: Schema retrieved successfully with response time
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 source:
 *                   type: string
 *                   example: "database"
 *                 responseTime:
 *                   type: string
 *                   example: "5ms"
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: "did:dcert:schema:diploma_certificate"
 *                     name:
 *                       type: string
 *                       example: "Diploma Certificate"
 *                     schema:
 *                       type: string
 *                       example: "{\"type\":\"object\"}"
 *                     issuer_did:
 *                       type: string
 *                       example: "did:dcert:iABCD1234567890"
 *                     version:
 *                       type: integer
 *                       example: 1
 *       404:
 *         description: Schema not found
 *       500:
 *         description: Internal server error
 */
router.get(
  "/schemas/database/:schemaId/:version",
  performanceController.getSchemaFromDatabase
);

/**
 * @swagger
 * /performance/schemas/blockchain/{schemaId}/{version}:
 *   get:
 *     summary: Get specific schema from blockchain (Performance Testing)
 *     description: |
 *       Fetch a specific schema by ID and version from Besu blockchain.
 *       Returns response time in milliseconds for performance comparison.
 *     tags:
 *       - Performance Testing
 *     parameters:
 *       - in: path
 *         name: schemaId
 *         required: true
 *         schema:
 *           type: string
 *         description: Schema ID
 *         example: "did:dcert:schema:diploma_certificate"
 *       - in: path
 *         name: version
 *         required: true
 *         schema:
 *           type: integer
 *         description: Schema version number
 *         example: 1
 *     responses:
 *       200:
 *         description: Schema retrieved successfully with response time
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 source:
 *                   type: string
 *                   example: "blockchain"
 *                 responseTime:
 *                   type: string
 *                   example: "45ms"
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: "did:dcert:schema:diploma_certificate"
 *                     name:
 *                       type: string
 *                       example: "Diploma Certificate"
 *                     schema:
 *                       type: string
 *                       example: "{\"type\":\"object\"}"
 *                     issuerDID:
 *                       type: string
 *                       example: "did:dcert:iABCD1234567890"
 *                     version:
 *                       type: integer
 *                       example: 1
 *       404:
 *         description: Schema not found
 *       500:
 *         description: Internal server error
 */
router.get(
  "/schemas/blockchain/:schemaId/:version",
  performanceController.getSchemaFromBlockchain
);

export default router;
