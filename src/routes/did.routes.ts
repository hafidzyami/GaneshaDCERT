import express, { Router } from "express";
import * as did from "../controllers/did.controller";
import {
  optionalInstitutionAuthMiddleware,
  verifyTokenInstitutionAuthMiddleware,
} from "../middlewares/auth.middleware";
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
 *           pattern: '^(?:did:dcert:[iu](?:[a-zA-Z0-9_-]{44}|[a-zA-Z0-9_-]{87})|[a-zA-Z0-9_-]{87})$'
 *           example: "did:dcert:iABCD1234567890-xyz_12345678901234567890abcd"
 *           description: DID identifier (55 chars total - did:dcert:[i/u] + 44 identifier chars or 98 chars total - did:dcert:[i/u] + 87 identifier chars)
 *         controller:
 *           type: string
 *           example: "did:dcert:iABCD1234567890-xyz_12345678901234567890abcd"
 *           description: DID controller
 *         verificationMethod:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               id:
 *                 type: string
 *                 example: "did:dcert:iABCD...#key-1"
 *               type:
 *                 type: string
 *                 example: "EcdsaSecp256k1VerificationKey2019"
 *               controller:
 *                 type: string
 *                 example: "did:dcert:iABCD..."
 *               publicKeyHex:
 *                 type: string
 *                 pattern: '^[a-fA-F0-9]{66,130}$'
 *                 example: "04a1b2c3d4e5f6789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcd"
 *                 description: Public key as hex string (NO 0x prefix)
 *         authentication:
 *           type: array
 *           items:
 *             type: string
 *           example: ["did:dcert:iABCD...#key-1"]
 *         assertionMethod:
 *           type: array
 *           items:
 *             type: string
 *           example: ["did:dcert:iABCD...#key-1"]
 *         created:
 *           type: string
 *           format: date-time
 *           example: "2025-10-21T10:30:00Z"
 *         updated:
 *           type: string
 *           format: date-time
 *           example: "2025-10-21T10:30:00Z"
 *
 *     DIDMetadata:
 *       type: object
 *       properties:
 *         name:
 *           type: string
 *           example: "John Doe"
 *         email:
 *           type: string
 *           format: email
 *           example: "john.doe@example.com"
 *         phone:
 *           type: string
 *           pattern: '^\+?[1-9]\d{1,14}$'
 *           example: "+6281234567890"
 *         country:
 *           type: string
 *           example: "Indonesia"
 *         website:
 *           type: string
 *           format: uri
 *           example: "https://example.com"
 *         address:
 *           type: string
 *           example: "Jl. Sudirman No. 1, Jakarta"
 */

/**
 * @swagger
 * /dids:
 *   post:
 *     summary: Register new DID
 *     description: |
 *       Register a new Decentralized Identifier (DID) on the blockchain with optional metadata.
 *
 *       **Authentication Requirements:**
 *       - Individual role: No token required
 *       - Institution role: Bearer token (MagicLink) REQUIRED
 *
 *       **DID Format Rules:**
 *       - Pattern: `did:dcert:[i/u][44 alphanumeric chars] | [87 alphanumeric chars]`
 *       - Total length: 55 characters
 *       - Prefix 'i' for institution, 'u' for individual/user
 *       - Characters allowed: a-z, A-Z, 0-9, _ (underscore), - (hyphen)
 *       - Examples:
 *         - Institution: `did:dcert:iABCD1234567890-xyz_12345678901234567890abcd`
 *         - Individual: `did:dcert:uXYZ9876543210-abc_98765432109876543210dcba`
 *
 *       **Public Key Format Rules:**
 *       - IMPORTANT: NO 0x prefix - hex characters only
 *       - Compressed (33 bytes): 66 hex characters
 *       - Uncompressed (65 bytes): 130 hex characters
 *       - Example compressed: `02a1b2c3d4e5f6789abcdef0123456789abcdef0123456789abcdef0123456789a`
 *       - Example uncompressed: `04a1b2c3d4e5f6789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcd`
 *
 *       **Process:**
 *       1. Validate public key format (hex only, no 0x prefix)
 *       2. Validate DID format (did:dcert:[i/u][44 chars])
 *       3. Check authentication (for institution only)
 *       4. Verify institution approval status
 *       5. Check if DID already exists
 *       6. Register DID on blockchain
 *       7. Store metadata in database
 *
 *       **Roles:**
 *       - `individual`: For personal/individual users (students, employees, etc.)
 *       - `institution`: For organizations (universities, companies, etc.)
 *     tags:
 *       - DID Management
 *     security:
 *       - InstitutionBearerAuth: []
 *     parameters:
 *       - in: header
 *         name: Authorization
 *         schema:
 *           type: string
 *         required: false
 *         description: Bearer token (Required only for institution role). Get token from magic link email.
 *         example: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
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
 *                 pattern: '^(?:did:dcert:[iu](?:[a-zA-Z0-9_-]{44}|[a-zA-Z0-9_-]{87})|[a-zA-Z0-9_-]{87})$'
 *                 example: "did:dcert:iABCD1234567890-xyz_12345678901234567890abcd"
 *                 description: DID string (55 chars - did:dcert:[i/u] + 44 identifier chars)
 *               public_key:
 *                 type: string
 *                 pattern: '^[a-fA-F0-9]{66,130}$'
 *                 example: "04a1b2c3d4e5f6789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcd"
 *                 description: Public key hex string WITHOUT 0x prefix (66 or 130 hex chars)
 *               role:
 *                 type: string
 *                 enum: [individual, institution]
 *                 example: "institution"
 *                 description: Role/type of the DID owner
 *               name:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 255
 *                 example: "University of Indonesia"
 *                 description: Name of the DID owner (individual or organization name)
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "admin@university.ac.id"
 *                 description: Contact email (auto-filled from token for institution)
 *               phone:
 *                 type: string
 *                 pattern: '^\+?[1-9]\d{1,14}$'
 *                 example: "+6281234567890"
 *                 description: Contact phone number in E.164 format
 *               country:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 100
 *                 example: "Indonesia"
 *                 description: Country
 *               website:
 *                 type: string
 *                 format: uri
 *                 example: "https://ui.ac.id"
 *                 description: Official website (mainly for institutions)
 *               address:
 *                 type: string
 *                 minLength: 5
 *                 maxLength: 500
 *                 example: "Depok, West Java, Indonesia"
 *                 description: Physical address
 *           examples:
 *             institutionCompressed:
 *               summary: Institution DID with Compressed Key
 *               value:
 *                 did_string: "did:dcert:iABCD1234567890-xyz_12345678901234567890abcd"
 *                 public_key: "02a1b2c3d4e5f6789abcdef0123456789abcdef0123456789abcdef0123456789a"
 *                 role: "institution"
 *                 name: "University of Indonesia"
 *                 email: "admin@ui.ac.id"
 *                 phone: "+6281234567890"
 *                 country: "Indonesia"
 *                 website: "https://ui.ac.id"
 *                 address: "Depok, West Java, Indonesia"
 *             institutionUncompressed:
 *               summary: Institution DID with Uncompressed Key
 *               value:
 *                 did_string: "did:dcert:iXYZ9876543210-abc_98765432109876543210dcba"
 *                 public_key: "04a1b2c3d4e5f6789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcd"
 *                 role: "institution"
 *                 name: "University of Indonesia"
 *                 email: "admin@ui.ac.id"
 *                 phone: "+6281234567890"
 *                 country: "Indonesia"
 *                 website: "https://ui.ac.id"
 *                 address: "Depok, West Java, Indonesia"
 *             individual:
 *               summary: Individual DID (Student)
 *               value:
 *                 did_string: "did:dcert:uJohnDoe1234-student_567890123456789012345678"
 *                 public_key: "03b2c3d4e5f6789abcdef0123456789abcdef0123456789abcdef0123456789ab"
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
 *                       example: "did:dcert:iABCD1234567890-xyz_12345678901234567890abcd"
 *                     transactionHash:
 *                       type: string
 *                       example: "9876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba"
 *                       description: Blockchain transaction hash (hex without 0x prefix)
 *                     blockNumber:
 *                       type: integer
 *                       example: 12345
 *                       description: Block number where transaction was mined
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
 *                   example: "Validation error"
 *                 errors:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       field:
 *                         type: string
 *                         example: "public_key"
 *                       message:
 *                         type: string
 *                         example: "Invalid public key format. Must be hex string (64-65 bytes, 128-130 hex characters)"
 *             examples:
 *               invalidDID:
 *                 summary: Invalid DID Format
 *                 value:
 *                   success: false
 *                   message: "Validation error"
 *                   errors:
 *                     - field: "did_string"
 *                       message: "Invalid DID format. Must follow pattern: did:method:identifier (e.g., did:dcert:iABC123...)"
 *               invalidPublicKey:
 *                 summary: Invalid Public Key Format
 *                 value:
 *                   success: false
 *                   message: "Validation error"
 *                   errors:
 *                     - field: "public_key"
 *                       message: "Invalid public key format. Must be hex string (64-65 bytes, 128-130 hex characters)"
 *       401:
 *         description: Unauthorized - Missing or invalid token for institution
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
 *                   example: "Authorization token is required for institution registration"
 *       403:
 *         description: Forbidden - Institution not approved
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
 *                   example: "Institution registration is not approved. Current status: PENDING"
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
 *                   example: "A DID Document already exists with this DID"
 *       500:
 *         description: Internal server error or blockchain failure
 */
router.post(
  "/",
  registerDIDValidator,
  verifyTokenInstitutionAuthMiddleware,
  did.registerDID
);

/**
 * @swagger
 * /dids/check/{did}:
 *   get:
 *     summary: Check if DID exists
 *     description: |
 *       Verify if a DID is registered on the blockchain and retrieve its status.
 *
 *       **DID Format:** `did:dcert:[i/u][44 chars]` (55 chars total)
 *       - Characters allowed: a-z, A-Z, 0-9, _ (underscore), - (hyphen)
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
 *           pattern: '^did:dcert:[iu](?:[a-zA-Z0-9_-]{44}|[a-zA-Z0-9_-]{87})$'
 *         example: "did:dcert:iABCD1234567890-xyz_12345678901234567890abcd"
 *         description: DID to check (format - did:dcert:[i/u] + 44 chars)
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
 *                     found:
 *                       type: boolean
 *                       example: true
 *                       description: Whether DID is registered
 *                     did:
 *                       type: string
 *                       example: "did:dcert:iABCD1234567890-xyz_12345678901234567890abcd"
 *                     message:
 *                       type: string
 *                       example: "DID exists"
 *             examples:
 *               exists:
 *                 summary: DID exists
 *                 value:
 *                   success: true
 *                   data:
 *                     found: true
 *                     message: "DID exists"
 *                     did: "did:dcert:iABCD1234567890-xyz_12345678901234567890abcd"
 *               notExists:
 *                 summary: DID does not exist
 *                 value:
 *                   success: true
 *                   message: "DID not found on blockchain"
 *                   data:
 *                     found: false
 *                     error: "Not Found"
 *                     message: "DID not found on blockchain"
 *                     did: "did:dcert:iABCD1234567890-xyz_12345678901234567890abcd"
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
 *                   example: "Invalid DID format. Expected: did:dcert:[i/u][44 chars]"
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
 *                     message:
 *                       type: string
 *                       example: "Number of blocks retrieved"
 *                     blockCount:
 *                       type: integer
 *                       example: 12345
 *                       description: Total number of blocks in the chain
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
 *       **DID Format:** `did:dcert:[i/u][44 chars]` (55 chars total)
 *       - Characters allowed: a-z, A-Z, 0-9, _ (underscore), - (hyphen)
 *
 *       **Public Key Format:** Hex only (NO 0x prefix), 66 or 130 hex chars
 *       - Compressed: 66 hex characters
 *       - Uncompressed: 130 hex characters
 *
 *       **Security Process:**
 *       1. Verify ownership using signature from old private key
 *       2. Validate new public key format (hex only, no 0x)
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
 *           pattern: '^did:dcert:[iu](?:[a-zA-Z0-9_-]{44}|[a-zA-Z0-9_-]{87})$'
 *         example: "did:dcert:iABCD1234567890-xyz_12345678901234567890abcd"
 *         description: DID to rotate key for (55 chars total)
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
 *                 pattern: '^[a-fA-F0-9]{66,130}$'
 *                 example: "04f6e5d4c3b2a19876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba98"
 *                 description: New public key hex string WITHOUT 0x prefix (66 or 130 hex chars)
 *               signature:
 *                 type: string
 *                 pattern: '^[a-fA-F0-9]+$'
 *                 example: "1234567890abcdef1234567890abcdef1234567890abcdef"
 *                 description: Signature hex string WITHOUT 0x prefix (sign with old private key)
 *               reason:
 *                 type: string
 *                 maxLength: 500
 *                 example: "Security upgrade - periodic key rotation"
 *                 description: Optional reason for key rotation
 *     responses:
 *       200:
 *         description: Key rotated successfully or DID not found
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
 *                   example: "Key rotated successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     found:
 *                       type: boolean
 *                       example: true
 *                     message:
 *                       type: string
 *                       example: "DID key rotated successfully"
 *                     did:
 *                       type: string
 *                       example: "did:dcert:iABCD1234567890-xyz_12345678901234567890abcd"
 *                     transactionHash:
 *                       type: string
 *                       example: "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"
 *                       description: Blockchain transaction hash (hex without 0x prefix)
 *                     blockNumber:
 *                       type: integer
 *                       example: 12346
 *             examples:
 *               success:
 *                 summary: Key rotated successfully
 *                 value:
 *                   success: true
 *                   message: "Key rotated successfully"
 *                   data:
 *                     found: true
 *                     message: "DID key rotated successfully"
 *                     did: "did:dcert:iABCD1234567890-xyz_12345678901234567890abcd"
 *                     transactionHash: "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"
 *                     blockNumber: 12346
 *               notFound:
 *                 summary: DID not found
 *                 value:
 *                   success: true
 *                   message: "DID not found on blockchain"
 *                   data:
 *                     found: false
 *                     error: "Not Found"
 *                     message: "DID not found on blockchain"
 *                     did: "did:dcert:iABCD1234567890-xyz_12345678901234567890abcd"
 *       400:
 *         description: Invalid key format or validation error
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
 *       **DID Format:** `did:dcert:[i/u][44 chars]` (55 chars total)
 *       - Characters allowed: a-z, A-Z, 0-9, _ (underscore), - (hyphen)
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
 *           pattern: '^did:dcert:[iu](?:[a-zA-Z0-9_-]{44}|[a-zA-Z0-9_-]{87})$'
 *         example: "did:dcert:iABCD1234567890-xyz_12345678901234567890abcd"
 *         description: DID to deactivate (55 chars total)
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
 *                 pattern: '^[a-fA-F0-9]+$'
 *                 example: "1234567890abcdef1234567890abcdef1234567890abcdef"
 *                 description: Signature hex string WITHOUT 0x prefix (sign the DID string)
 *               reason:
 *                 type: string
 *                 maxLength: 500
 *                 example: "Organization discontinued operations"
 *                 description: Reason for deactivation (for audit trail)
 *     responses:
 *       200:
 *         description: DID deactivated successfully or DID not found
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
 *                     found:
 *                       type: boolean
 *                       example: true
 *                     message:
 *                       type: string
 *                       example: "DID deactivated successfully"
 *                     did:
 *                       type: string
 *                       example: "did:dcert:iABCD1234567890-xyz_12345678901234567890abcd"
 *                     transactionHash:
 *                       type: string
 *                       example: "fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210"
 *                       description: Blockchain transaction hash (hex without 0x prefix)
 *                     blockNumber:
 *                       type: integer
 *                       example: 12347
 *             examples:
 *               success:
 *                 summary: DID deactivated successfully
 *                 value:
 *                   success: true
 *                   message: "DID deactivated successfully"
 *                   data:
 *                     found: true
 *                     message: "DID deactivated successfully"
 *                     did: "did:dcert:iABCD1234567890-xyz_12345678901234567890abcd"
 *                     transactionHash: "fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210"
 *                     blockNumber: 12347
 *               notFound:
 *                 summary: DID not found
 *                 value:
 *                   success: true
 *                   message: "DID not found on blockchain"
 *                   data:
 *                     found: false
 *                     error: "Not Found"
 *                     message: "DID not found on blockchain"
 *                     did: "did:dcert:iABCD1234567890-xyz_12345678901234567890abcd"
 *       400:
 *         description: Invalid signature or validation error
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
 *       **DID Format:** `did:dcert:[i/u][44 chars]` (55 chars total)
 *       - Characters allowed: a-z, A-Z, 0-9, _ (underscore), - (hyphen)
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
 *           pattern: '^did:dcert:[iu](?:[a-zA-Z0-9_-]{44}|[a-zA-Z0-9_-]{87})$'
 *         example: "did:dcert:iABCD1234567890-xyz_12345678901234567890abcd"
 *         description: DID to get document for (55 chars total)
 *     responses:
 *       200:
 *         description: DID Document retrieved successfully or DID not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   oneOf:
 *                     - $ref: '#/components/schemas/DIDDocument'
 *                     - type: object
 *                       properties:
 *                         found:
 *                           type: boolean
 *                           example: false
 *                         error:
 *                           type: string
 *                           example: "Not Found"
 *                         message:
 *                           type: string
 *                           example: "DID not found on blockchain"
 *                         did:
 *                           type: string
 *             examples:
 *               found:
 *                 summary: DID Document Found
 *                 value:
 *                   success: true
 *                   data:
 *                     found: true
 *                     message: "DID document retrieved successfully"
 *                     id: "did:dcert:iABCD1234567890-xyz_12345678901234567890abcd"
 *                     status: "Active"
 *                     role: "Institutional"
 *                     keyId: "#key-1"
 *                     "#key-1": "04a1b2c3d4e5f6789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcd"
 *                     details:
 *                       email: "admin@ui.ac.id"
 *                       name: "Universitas Indonesia"
 *                       phone: "+6281234567890"
 *                       country: "Indonesia"
 *                       website: "https://ui.ac.id"
 *                       address: "Depok, West Java, Indonesia"
 *               notFound:
 *                 summary: DID Not Found
 *                 value:
 *                   success: true
 *                   message: "DID not found on blockchain"
 *                   data:
 *                     found: false
 *                     error: "Not Found"
 *                     message: "DID not found on blockchain"
 *                     did: "did:dcert:iABCD1234567890-xyz_12345678901234567890abcd"
 *       500:
 *         description: Internal server error or blockchain failure
 */
router.get("/:did/document", getDIDDocumentValidator, did.getDIDDocument);

export default router;
