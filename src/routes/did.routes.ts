import express, { Router } from "express";
import * as did from "../controllers/did.controller";
import {
  registerDIDValidator,
  checkDIDValidator,
  keyRotationValidator,
  deleteDIDValidator,
  getDIDDocumentValidator,
} from "../validators/did.validator";

const router: Router = express.Router();

/**
 * @swagger
 * tags:
 *   name: DID & Account Management
 *   description: DID registration, key rotation, and account management
 */

/**
 * @swagger
 * /did:
 *   post:
 *     summary: Register new DID
 *     description: Register a new Decentralized Identifier (DID) on the blockchain
 *     tags:
 *       - DID & Account Management
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - public_key
 *             properties:
 *               public_key:
 *                 type: string
 *                 example: "0x04a1b2c3d4e5f6..."
 *                 description: Public key untuk DID
 *               metadata:
 *                 type: object
 *                 description: Optional metadata for DID
 *     responses:
 *       201:
 *         description: DID registered successfully
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
 *                   example: DID berhasil didaftarkan
 *                 data:
 *                   type: object
 *                   properties:
 *                     did:
 *                       type: string
 *                       example: did:ganesha:0x1234567890abcdef
 *                     block_hash:
 *                       type: string
 *                     block_index:
 *                       type: integer
 *       400:
 *         description: Invalid public key or validation error
 *       409:
 *         description: DID already exists
 *       500:
 *         description: Internal server error
 */
router.post("/", registerDIDValidator, did.registerDID);

/**
 * @swagger
 * /did/check/{did}:
 *   get:
 *     summary: Check if DID exists
 *     description: Verify if a DID is registered on the blockchain
 *     tags:
 *       - DID & Account Management
 *     parameters:
 *       - in: path
 *         name: did
 *         required: true
 *         schema:
 *           type: string
 *         example: did:ganesha:0x1234567890abcdef
 *         description: DID to check
 *     responses:
 *       200:
 *         description: DID check result
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
 *                     exists:
 *                       type: boolean
 *                       example: true
 *                     did:
 *                       type: string
 *                     status:
 *                       type: string
 *                       enum: [ACTIVE, DEACTIVATED]
 *       400:
 *         description: Invalid DID format
 *       500:
 *         description: Internal server error
 */
router.get("/check/:did", checkDIDValidator, did.checkDID);

/**
 * @swagger
 * /did/blocks:
 *   get:
 *     summary: Get blockchain block count
 *     description: Retrieve the total number of blocks in the blockchain
 *     tags:
 *       - DID & Account Management
 *     responses:
 *       200:
 *         description: Block count retrieved successfully
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
 *                     block_count:
 *                       type: integer
 *                       example: 12345
 *       500:
 *         description: Internal server error
 */
router.get("/blocks", did.numberofBlocks);

/**
 * @swagger
 * /did/{did}/key-rotation:
 *   put:
 *     summary: Rotate DID key
 *     description: Update the public key associated with a DID (key rotation for security)
 *     tags:
 *       - DID & Account Management
 *     parameters:
 *       - in: path
 *         name: did
 *         required: true
 *         schema:
 *           type: string
 *         example: did:ganesha:0x1234567890abcdef
 *         description: DID to rotate key for
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - new_public_key
 *               - old_private_key_signature
 *             properties:
 *               new_public_key:
 *                 type: string
 *                 example: "0x04f6e5d4c3b2a1..."
 *                 description: New public key
 *               old_private_key_signature:
 *                 type: string
 *                 description: Signature using old private key for verification
 *     responses:
 *       200:
 *         description: Key rotated successfully
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
 *                   example: Key berhasil dirotasi
 *                 data:
 *                   type: object
 *                   properties:
 *                     did:
 *                       type: string
 *                     new_public_key:
 *                       type: string
 *                     block_hash:
 *                       type: string
 *       400:
 *         description: Invalid key or signature
 *       401:
 *         description: Unauthorized - Invalid signature
 *       404:
 *         description: DID not found
 *       500:
 *         description: Internal server error
 */
router.put("/:did/key-rotation", keyRotationValidator, did.keyRotation);

/**
 * @swagger
 * /did/{did}:
 *   delete:
 *     summary: Deactivate DID
 *     description: Deactivate a DID (soft delete - marks as inactive on blockchain)
 *     tags:
 *       - DID & Account Management
 *     parameters:
 *       - in: path
 *         name: did
 *         required: true
 *         schema:
 *           type: string
 *         example: did:ganesha:0x1234567890abcdef
 *         description: DID to deactivate
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - private_key_signature
 *             properties:
 *               private_key_signature:
 *                 type: string
 *                 description: Signature using private key for verification
 *               reason:
 *                 type: string
 *                 description: Reason for deactivation
 *     responses:
 *       200:
 *         description: DID deactivated successfully
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
 *                   example: DID berhasil dinonaktifkan
 *                 data:
 *                   type: object
 *                   properties:
 *                     did:
 *                       type: string
 *                     status:
 *                       type: string
 *                       example: DEACTIVATED
 *       400:
 *         description: Invalid signature
 *       401:
 *         description: Unauthorized - Invalid signature
 *       404:
 *         description: DID not found
 *       500:
 *         description: Internal server error
 */
router.delete("/:did", deleteDIDValidator, did.deleteDID);

/**
 * @swagger
 * /did/{did}/document:
 *   get:
 *     summary: Get DID Document
 *     description: Retrieve the complete DID Document containing all DID information and metadata
 *     tags:
 *       - DID & Account Management
 *     parameters:
 *       - in: path
 *         name: did
 *         required: true
 *         schema:
 *           type: string
 *         example: did:ganesha:0x1234567890abcdef
 *         description: DID to get document for
 *     responses:
 *       200:
 *         description: DID Document retrieved successfully
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
 *                     '@context':
 *                       type: string
 *                       example: https://www.w3.org/ns/did/v1
 *                     id:
 *                       type: string
 *                       example: did:ganesha:0x1234567890abcdef
 *                     publicKey:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           type:
 *                             type: string
 *                           controller:
 *                             type: string
 *                           publicKeyHex:
 *                             type: string
 *                     authentication:
 *                       type: array
 *                       items:
 *                         type: string
 *                     created:
 *                       type: string
 *                       format: date-time
 *                     updated:
 *                       type: string
 *                       format: date-time
 *       404:
 *         description: DID not found
 *       500:
 *         description: Internal server error
 */
router.get("/:did/document", getDIDDocumentValidator, did.getDIDDocument);

export default router;
