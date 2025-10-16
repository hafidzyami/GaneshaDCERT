/**
 * DID Routes
 * Enhanced with better validation and new endpoints
 */

import express, { Router } from "express";
import { body, param } from "express-validator";

import * as didController from "../controllers/did";

const router: Router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     DIDDocument:
 *       type: object
 *       properties:
 *         '@context':
 *           type: array
 *           items:
 *             type: string
 *         id:
 *           type: string
 *         controller:
 *           type: string
 *         verificationMethod:
 *           type: array
 *           items:
 *             type: object
 *         authentication:
 *           type: array
 *           items:
 *             type: string
 *     
 *     SuccessResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         message:
 *           type: string
 *         data:
 *           type: object
 *         timestamp:
 *           type: string
 *           format: date-time
 *     
 *     ErrorResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: false
 *         message:
 *           type: string
 *         error:
 *           type: string
 *         details:
 *           type: object
 *         timestamp:
 *           type: string
 *           format: date-time
 */

/**
 * @swagger
 * /dids:
 *   post:
 *     summary: Register a new DID
 *     description: |
 *       Register a new Decentralized Identifier (DID) on the blockchain.
 *       
 *       **Important Notes:**
 *       - DID string is generated on the frontend
 *       - Must follow W3C DID specification format: `did:method:identifier`
 *       - Public key must be a valid hex string (64-132 characters)
 *       - DID must be unique (will be checked on blockchain)
 *     tags:
 *       - DID & Account Management
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - did_string
 *               - public_key
 *               - role
 *             properties:
 *               did_string:
 *                 type: string
 *                 description: The DID string following W3C format
 *                 example: "did:ganesh:123456789abcdefghi"
 *               public_key:
 *                 type: string
 *                 description: Public key in hexadecimal format
 *                 example: "0x04a34b99f22c790c4e36b2b3c2c35a36db06226e41c692fc82b8b56ac1c540c5bd5b8dec5235a0fa8722476c7709c02559e3aa73aa03918ba2d492eea75abea235"
 *               role:
 *                 type: string
 *                 enum: [holder, issuer, verifier]
 *                 description: The role of the DID owner
 *                 example: "holder"
 *     responses:
 *       201:
 *         description: DID registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         description: Validation error or invalid input
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       409:
 *         description: DID already exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post(
  "/",
  [
    body("did_string")
      .trim()
      .notEmpty()
      .withMessage("DID string is required")
      .isLength({ min: 7, max: 200 })
      .withMessage("DID string must be between 7 and 200 characters"),
    body("public_key")
      .trim()
      .notEmpty()
      .withMessage("Public key is required")
      .isLength({ min: 64, max: 200 })
      .withMessage("Public key must be at least 64 characters"),
    body("role")
      .trim()
      .notEmpty()
      .withMessage("Role is required")
      .isIn(["holder", "issuer", "verifier"])
      .withMessage("Role must be one of: holder, issuer, verifier"),
  ],
  didController.registerDID
);

/**
 * @swagger
 * /dids/{did}/key-rotation:
 *   put:
 *     summary: Rotate DID Key
 *     description: |
 *       Rotate the cryptographic key pair associated with a DID.
 *       
 *       **Important Notes:**
 *       - The iteration number must be incremented from the previous rotation
 *       - Old public key must match the current key on blockchain
 *       - New public key must be different from old public key
 *       - This operation is irreversible
 *     tags:
 *       - DID & Account Management
 *     parameters:
 *       - in: path
 *         name: did
 *         required: true
 *         schema:
 *           type: string
 *         description: The DID to rotate the key for
 *         example: "did:ganesh:123456789abcdefghi"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - old_public_key
 *               - new_public_key
 *               - iteration_number
 *             properties:
 *               old_public_key:
 *                 type: string
 *                 description: Current public key
 *                 example: "0x04a34b99f22c790c..."
 *               new_public_key:
 *                 type: string
 *                 description: New public key to rotate to
 *                 example: "0x04b45c88e33d891d..."
 *               iteration_number:
 *                 type: integer
 *                 description: Incremental iteration number (starts from 1)
 *                 example: 2
 *                 minimum: 1
 *     responses:
 *       200:
 *         description: Key rotated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         description: Validation error
 *       404:
 *         description: DID not found
 *       500:
 *         description: Internal server error
 */
router.put(
  "/:did/key-rotation",
  [
    param("did")
      .trim()
      .notEmpty()
      .withMessage("DID is required in path"),
    body("old_public_key")
      .trim()
      .notEmpty()
      .withMessage("Old public key is required"),
    body("new_public_key")
      .trim()
      .notEmpty()
      .withMessage("New public key is required"),
    body("iteration_number")
      .isInt({ min: 1 })
      .withMessage("Iteration number must be a positive integer")
      .toInt(),
  ],
  didController.keyRotation
);

/**
 * @swagger
 * /dids/{did}:
 *   delete:
 *     summary: Delete (Revoke) a DID
 *     description: |
 *       Permanently revoke a DID and all associated Verifiable Credentials.
 *       
 *       **Warning:**
 *       - This action is irreversible
 *       - All VCs associated with this DID will be revoked
 *       - VC revocation happens asynchronously via message queue
 *       - The DID Document will be marked as revoked on the blockchain
 *     tags:
 *       - DID & Account Management
 *     parameters:
 *       - in: path
 *         name: did
 *         required: true
 *         schema:
 *           type: string
 *         description: The DID to delete
 *         example: "did:ganesh:123456789abcdefghi"
 *     responses:
 *       200:
 *         description: Account deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         description: Validation error
 *       404:
 *         description: DID not found
 *       500:
 *         description: Internal server error
 */
router.delete(
  "/:did",
  [
    param("did")
      .trim()
      .notEmpty()
      .withMessage("DID is required in path"),
  ],
  didController.deleteDID
);

/**
 * @swagger
 * /dids/{did}/document:
 *   get:
 *     summary: Get DID Document
 *     description: |
 *       Retrieve the public DID Document for a given DID.
 *       
 *       **Notes:**
 *       - This is a PUBLIC endpoint (no authentication required)
 *       - Returns the full W3C compliant DID Document
 *       - Includes verification methods, authentication methods, and service endpoints
 *       - Can be used by anyone to verify credentials
 *     tags:
 *       - DID & Account Management
 *     parameters:
 *       - in: path
 *         name: did
 *         required: true
 *         schema:
 *           type: string
 *         description: The DID to fetch the document for
 *         example: "did:ganesh:123456789abcdefghi"
 *     responses:
 *       200:
 *         description: DID Document retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         didDocument:
 *                           $ref: '#/components/schemas/DIDDocument'
 *       400:
 *         description: Invalid DID format
 *       404:
 *         description: DID Document not found
 *       500:
 *         description: Internal server error
 */
router.get(
  "/:did/document",
  [
    param("did")
      .trim()
      .notEmpty()
      .withMessage("DID is required in path"),
  ],
  didController.getDIDDocument
);

/**
 * @swagger
 * /dids/{did}/metadata:
 *   get:
 *     summary: Get DID Metadata
 *     description: |
 *       Retrieve metadata about a DID without fetching the full document.
 *       Useful for quick checks and validation.
 *       
 *       **Returns:**
 *       - DID existence status
 *       - DID method
 *       - Creation/update timestamps
 *       - Count of verification and authentication methods
 *     tags:
 *       - DID & Account Management
 *     parameters:
 *       - in: path
 *         name: did
 *         required: true
 *         schema:
 *           type: string
 *         description: The DID to fetch metadata for
 *         example: "did:ganesh:123456789abcdefghi"
 *     responses:
 *       200:
 *         description: DID metadata retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         description: Invalid DID format
 *       404:
 *         description: DID not found
 *       500:
 *         description: Internal server error
 */
router.get(
  "/:did/metadata",
  [
    param("did")
      .trim()
      .notEmpty()
      .withMessage("DID is required in path"),
  ],
  didController.getDIDMetadata
);

export default router;
