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
 *   name: DID Management
 *   description: Decentralized Identifier (DID) registration, verification, and lifecycle management on blockchain
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     DIDDocument:
 *       type: object
 *       description: W3C DID Document structure
 *       properties:
 *         '@context':
 *           type: array
 *           items:
 *             type: string
 *           example: ["https://www.w3.org/ns/did/v1"]
 *           description: JSON-LD context
 *         id:
 *           type: string
 *           example: "did:dcert:1234567890abcdef"
 *           description: DID identifier
 *         controller:
 *           type: string
 *           example: "did:dcert:1234567890abcdef"
 *           description: DID controller
 *         verificationMethod:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               id:
 *                 type: string
 *                 example: "did:dcert:123...#key-1"
 *               type:
 *                 type: string
 *                 example: "EcdsaSecp256k1VerificationKey2019"
 *               controller:
 *                 type: string
 *                 example: "did:dcert:123..."
 *               publicKeyHex:
 *                 type: string
 *                 example: "04a1b2c3d4e5f6..."
 *         authentication:
 *           type: array
 *           items:
 *             type: string
 *           example: ["did:dcert:123...#key-1"]
 *         assertionMethod:
 *           type: array
 *           items:
 *             type: string
 *           example: ["did:dcert:123...#key-1"]
 *         created:
 *           type: string
 *           format: date-time
 *           example: "2025-10-21T10:30:00Z"
 *         updated:
 *           type: string
 *           format: date-time
 *           example: "2025-10-21T10:30:00Z"
 */

/**
 * @swagger
 * /dids:
 *   post:
 *     summary: Register new DID
 *     description: |
 *       Register a new Decentralized Identifier (DID) on the blockchain.
 *
 *       **Process:**
 *       1. Validate public key format and DID string
 *       2. Check if DID already exists on blockchain
 *       3. For institution role: Query institution data from InstitutionRegistration table using email
 *       4. Verify institution is APPROVED before registration
 *       5. Register DID on blockchain with all required data
 *
 *       **DID Format:** `did:dcert:<address>`
 *
 *       **Roles:**
 *       - `individual`: For personal/individual users (students, employees, etc.) - no email required
 *       - `institution`: For organizations (universities, companies, etc.) - email required to query institution data
 *
 *       **Institution Registration Flow:**
 *       For institution role, the system automatically retrieves name, phone, country, website, and address
 *       from the InstitutionRegistration table based on the provided email. The institution must have
 *       APPROVED status to proceed with DID registration.
 *     tags:
 *       - DID Management
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
 *                 example: "did:dcert:1234567890abcdef"
 *                 description: DID string to register
 *               public_key:
 *                 type: string
 *                 example: "c137d47e2181ace4e14e7d0870eccf3817e51b34129f98c351230b396e37b5f985c0c2b80ceecafba8ee4017a02dbd5ebfafb29db50b7d5bc4e0800d598460d3"
 *                 description: Public key in hexadecimal format (compressed or uncompressed)
 *               role:
 *                 type: string
 *                 enum: [individual, institution]
 *                 example: "institution"
 *                 description: Role/type of the DID owner
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "admin@university.ac.id"
 *                 description: Email address (REQUIRED for institution role, used to query InstitutionRegistration data)
 *           examples:
 *             institution:
 *               summary: Institution DID (University)
 *               value:
 *                 did_string: "did:dcert:742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
 *                 public_key: "04a1b2c3d4e5f6789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef01234"
 *                 role: "institution"
 *                 email: "admin@ui.ac.id"
 *             individual:
 *               summary: Individual DID (Student)
 *               value:
 *                 did_string: "did:dcert:8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199"
 *                 public_key: "04b2c3d4e5f6789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef012345"
 *                 role: "individual"
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
 *                   example: "DID registered successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     message:
 *                       type: string
 *                       example: "Institutional DID registered successfully"
 *                     did:
 *                       type: string
 *                       example: "did:dcert:1234567890abcdef"
 *                     institution:
 *                       type: object
 *                       description: Institution data retrieved from InstitutionRegistration (only for institution role)
 *                       properties:
 *                         email:
 *                           type: string
 *                           example: "admin@ui.ac.id"
 *                         name:
 *                           type: string
 *                           example: "University of Indonesia"
 *                         phone:
 *                           type: string
 *                           example: "+62-21-7270011"
 *                         country:
 *                           type: string
 *                           example: "Indonesia"
 *                         website:
 *                           type: string
 *                           example: "https://ui.ac.id"
 *                         address:
 *                           type: string
 *                           example: "Depok, West Java, Indonesia"
 *                     transactionHash:
 *                       type: string
 *                       example: "9876543210fedcba..."
 *                       description: Blockchain transaction hash
 *                     blockNumber:
 *                       type: number
 *                       example: 12345
 *                       description: Block number where transaction was included
 *       400:
 *         description: Invalid request data or validation error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Email is required for institution role"
 *                 errors:
 *                   type: array
 *                   items:
 *                     type: object
 *       404:
 *         description: Institution not found in registration database
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Institution with email admin@example.com not found in registration database"
 *       409:
 *         description: DID already exists
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "A DID Document already exists with this DID."
 *       500:
 *         description: Internal server error or blockchain failure
 */
router.post("/", registerDIDValidator, did.registerDID);

/**
 * @swagger
 * /dids/check/{did}:
 *   get:
 *     summary: Check if DID exists
 *     description: |
 *       Verify if a DID is registered on the blockchain and retrieve its status.
 *
 *       **Use cases:**
 *       - Verify DID before issuing credentials
 *       - Check DID status (active/deactivated)
 *       - Validate DID format and existence
 *     tags:
 *       - DID Management
 *     parameters:
 *       - in: path
 *         name: did
 *         required: true
 *         schema:
 *           type: string
 *         example: "did:dcert:742d35635634C0532925a3b844Bc9e7595f0bEb"
 *         description: DID to check (format - did:dcert:<address>)
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
 *                       description: Whether DID is registered
 *                     did:
 *                       type: string
 *                       example: "did:dcert:742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
 *                     status:
 *                       type: string
 *                       enum: [ACTIVE, DEACTIVATED]
 *                       example: "ACTIVE"
 *                       description: Current DID status
 *                     public_key:
 *                       type: string
 *                       example: "04a1b2c3d4e5f6..."
 *                       description: Associated public key
 *                     role:
 *                       type: string
 *                       enum: [individual, institution]
 *                       example: "institution"
 *                     registered_at:
 *                       type: string
 *                       format: date-time
 *                       example: "2025-10-21T10:30:00Z"
 *             examples:
 *               exists:
 *                 summary: DID exists and active
 *                 value:
 *                   success: true
 *                   data:
 *                     exists: true
 *                     did: "did:dcert:742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
 *                     status: "ACTIVE"
 *                     public_key: "04a1b2c3..."
 *                     role: "institution"
 *                     registered_at: "2025-10-21T10:30:00Z"
 *               notExists:
 *                 summary: DID does not exist
 *                 value:
 *                   success: true
 *                   data:
 *                     exists: false
 *                     did: "did:dcert:742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
 *       400:
 *         description: Invalid DID format
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Invalid DID format. Expected: did:dcert:<address>"
 *       500:
 *         description: Internal server error
 */
router.get("/check/:did", checkDIDValidator, did.checkDID);

/**
 * @swagger
 * /dids/blocks:
 *   get:
 *     summary: Get blockchain block count
 *     description: |
 *       Retrieve the total number of blocks in the DID blockchain.
 *
 *       **Use cases:**
 *       - Monitor blockchain growth
 *       - Verify blockchain synchronization
 *       - Display blockchain statistics
 *     tags:
 *       - DID Management
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
 *                       description: Total number of blocks in the chain
 *                     last_block_time:
 *                       type: string
 *                       format: date-time
 *                       example: "2025-10-21T10:30:00Z"
 *                       description: Timestamp of the last block
 *       500:
 *         description: Internal server error or blockchain connection failure
 */
router.get("/blocks", did.numberofBlocks);

/**
 * @swagger
 * /dids/{did}/key-rotation:
 *   put:
 *     summary: Rotate DID key
 *     description: |
 *       Update the public key associated with a DID for security purposes (key rotation).
 *
 *       **Security Process:**
 *       1. Verify ownership using signature from old private key
 *       2. Validate new public key format
 *       3. Update key on blockchain
 *       4. Update DID document
 *
 *       **Important:** Keep the old private key secure until rotation is complete.
 *     tags:
 *       - DID Management
 *     parameters:
 *       - in: path
 *         name: did
 *         required: true
 *         schema:
 *           type: string
 *         example: "did:dcert:742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
 *         description: DID to rotate key for
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - new_public_key
 *               - signature
 *             properties:
 *               new_public_key:
 *                 type: string
 *                 example: "04f6e5d4c3b2a19876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba98765432"
 *                 description: New public key in hexadecimal format
 *               signature:
 *                 type: string
 *                 example: "1234567890abcdef..."
 *                 description: Signature created with old private key (sign the new public key)
 *               reason:
 *                 type: string
 *                 example: "Security upgrade - periodic key rotation"
 *                 description: Optional reason for key rotation
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
 *                   example: "DID key rotated successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     did:
 *                       type: string
 *                       example: "did:dcert:742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
 *                     old_public_key:
 *                       type: string
 *                       example: "04a1b2c3d4e5f6..."
 *                     new_public_key:
 *                       type: string
 *                       example: "04f6e5d4c3b2a1..."
 *                     blockchain_tx_hash:
 *                       type: string
 *                       example: "abcdef1234567890..."
 *                     rotated_at:
 *                       type: string
 *                       format: date-time
 *                       example: "2025-10-21T10:30:00Z"
 *       400:
 *         description: Invalid key format or validation error
 *       401:
 *         description: Unauthorized - Invalid signature
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Invalid signature. Cannot verify ownership"
 *       404:
 *         description: DID not found
 *       500:
 *         description: Internal server error or blockchain failure
 */
router.put("/:did/key-rotation", keyRotationValidator, did.keyRotation);

/**
 * @swagger
 * /dids/{did}:
 *   delete:
 *     summary: Deactivate DID
 *     description: |
 *       Deactivate a DID on the blockchain (soft delete - marks as inactive).
 *
 *       **Important:**
 *       - Deactivated DIDs cannot issue new credentials
 *       - Existing credentials remain valid (unless revoked separately)
 *       - Deactivation is permanent and cannot be reversed
 *       - Requires signature proof of ownership
 *
 *       **Use cases:**
 *       - Account closure
 *       - Security breach
 *       - Organizational changes
 *     tags:
 *       - DID Management
 *     parameters:
 *       - in: path
 *         name: did
 *         required: true
 *         schema:
 *           type: string
 *         example: "did:dcert:742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
 *         description: DID to deactivate
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - signature
 *             properties:
 *               signature:
 *                 type: string
 *                 example: "1234567890abcdef..."
 *                 description: Signature using private key for verification (sign the DID string)
 *               reason:
 *                 type: string
 *                 example: "Organization discontinued operations"
 *                 description: Reason for deactivation (for audit trail)
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
 *                   example: "DID deactivated successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     did:
 *                       type: string
 *                       example: "did:dcert:742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
 *                     status:
 *                       type: string
 *                       example: "DEACTIVATED"
 *                     deactivated_at:
 *                       type: string
 *                       format: date-time
 *                       example: "2025-10-21T10:30:00Z"
 *                     blockchain_tx_hash:
 *                       type: string
 *                       example: "fedcba9876543210..."
 *       400:
 *         description: Invalid signature or validation error
 *       401:
 *         description: Unauthorized - Invalid signature
 *       404:
 *         description: DID not found
 *       409:
 *         description: DID already deactivated
 *       500:
 *         description: Internal server error or blockchain failure
 */
router.delete("/:did", deleteDIDValidator, did.deleteDID);

/**
 * @swagger
 * /dids/{did}/document:
 *   get:
 *     summary: Get DID Document
 *     description: |
 *       Retrieve the complete W3C DID Document containing all DID information, verification methods, and metadata.
 *
 *       **DID Document Contents:**
 *       - DID identifier
 *       - Verification methods (public keys)
 *       - Authentication methods
 *       - Assertion methods (for VCs)
 *       - Service endpoints
 *       - Created/Updated timestamps
 *
 *       **Standards:**
 *       - Follows W3C DID Core specification
 *       - JSON-LD format with proper context
 *     tags:
 *       - DID Management
 *     parameters:
 *       - in: path
 *         name: did
 *         required: true
 *         schema:
 *           type: string
 *         example: "did:dcert:742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
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
 *                   $ref: '#/components/schemas/DIDDocument'
 *             examples:
 *               university:
 *                 summary: University DID Document
 *                 value:
 *                   success: true
 *                   data:
 *                     '@context':
 *                       - "https://www.w3.org/ns/did/v1"
 *                       - "https://w3id.org/security/v1"
 *                     id: "did:dcert:742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
 *                     controller: "did:dcert:742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
 *                     verificationMethod:
 *                       - id: "did:dcert:742d35Cc6634C0532925a3b844Bc9e7595f0bEb#key-1"
 *                         type: "EcdsaSecp256k1VerificationKey2019"
 *                         controller: "did:dcert:742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
 *                         publicKeyHex: "04a1b2c3d4e5f6789abcdef..."
 *                     authentication:
 *                       - "did:dcert:742d35Cc6634C0532925a3b844Bc9e7595f0bEb#key-1"
 *                     assertionMethod:
 *                       - "did:dcert:742d35Cc6634C0532925a3b844Bc9e7595f0bEb#key-1"
 *                     created: "2025-10-21T10:30:00Z"
 *                     updated: "2025-10-21T10:30:00Z"
 *       404:
 *         description: DID not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "DID not found"
 *       500:
 *         description: Internal server error or blockchain failure
 */
router.get("/:did/document", getDIDDocumentValidator, did.getDIDDocument);

export default router;
