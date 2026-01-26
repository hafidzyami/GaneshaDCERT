import express, { Router } from "express";
import * as did from "../controllers/did.controller";
import {
  optionalInstitutionAuthMiddleware,
  verifyTokenInstitutionAuthMiddleware,
} from "../middlewares/auth.middleware";
import { adminAuthMiddleware } from "../middlewares/adminAuth.middleware";
import { verifyDIDSignature } from "../middlewares/didAuth.middleware";
import {
  registerDIDValidator,
  checkDIDValidator,
  keyRotationValidator,
  deleteDIDValidator,
  deleteDIDByAdminValidator,
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
 *     VerificationMethod:
 *       type: object
 *       description: W3C Verification Method
 *       properties:
 *         id:
 *           type: string
 *           example: "did:dcert:uBI57YIz1cgJ_iHkIYt-CDGDlU10y0khtjFH31PSP3iPN1hOEZxd3fodVKefn4eeipAyomLxY8lEl6GIZiBBEIys#key-1"
 *           description: Verification method ID
 *         type:
 *           type: string
 *           example: "EcdsaSecp256k1VerificationKey2019"
 *           description: Verification method type
 *         controller:
 *           type: string
 *           example: "did:dcert:uBI57YIz1cgJ_iHkIYt-CDGDlU10y0khtjFH31PSP3iPN1hOEZxd3fodVKefn4eeipAyomLxY8lEl6GIZiBBEIys"
 *           description: DID controller
 *         publicKeyHex:
 *           type: string
 *           pattern: '^[a-fA-F0-9]{66,130}$'
 *           example: "044e78e5591ac4f0af85d92982cff7d00e0aad04e333063e56f1a1893507e9cc9b63a5d8948975d6483d0526940f2d82556a42353820a728f834e56fadca3a2b38"
 *           description: Public key as hex string (NO 0x prefix)
 *
 *     ServiceEndpoint:
 *       type: object
 *       description: W3C Service Endpoint
 *       properties:
 *         id:
 *           type: string
 *           example: "did:dcert:iABCD...#institution-profile"
 *           description: Service endpoint ID
 *         type:
 *           type: string
 *           example: "InstitutionProfile"
 *           description: Service type
 *         serviceEndpoint:
 *           oneOf:
 *             - type: string
 *             - type: object
 *           description: Service endpoint URL or object
 *
 *     DIDDocument:
 *       type: object
 *       description: W3C DID Core Specification compliant DID Document
 *       properties:
 *         '@context':
 *           type: array
 *           items:
 *             type: string
 *           example: ["https://www.w3.org/ns/did/v1.1", "https://w3id.org/security/suites/secp256k1-2019/v1"]
 *           description: JSON-LD context
 *         id:
 *           type: string
 *           example: "did:dcert:uBI57YIz1cgJ_iHkIYt-CDGDlU10y0khtjFH31PSP3iPN1hOEZxd3fodVKefn4eeipAyomLxY8lEl6GIZiBBEIys"
 *           description: DID identifier
 *         controller:
 *           type: string
 *           example: "did:dcert:uBI57YIz1cgJ_iHkIYt-CDGDlU10y0khtjFH31PSP3iPN1hOEZxd3fodVKefn4eeipAyomLxY8lEl6GIZiBBEIys"
 *           description: DID controller
 *         verificationMethod:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/VerificationMethod'
 *           description: Verification methods (public keys)
 *         authentication:
 *           type: array
 *           items:
 *             type: string
 *           example: ["did:dcert:uBI57YIz1cgJ_iHkIYt-CDGDlU10y0khtjFH31PSP3iPN1hOEZxd3fodVKefn4eeipAyomLxY8lEl6GIZiBBEIys#key-1"]
 *           description: Authentication verification method references
 *         assertionMethod:
 *           type: array
 *           items:
 *             type: string
 *           example: ["did:dcert:uBI57YIz1cgJ_iHkIYt-CDGDlU10y0khtjFH31PSP3iPN1hOEZxd3fodVKefn4eeipAyomLxY8lEl6GIZiBBEIys#key-1"]
 *           description: Assertion verification method references
 *         service:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/ServiceEndpoint'
 *           description: Service endpoints (for institutional DIDs)
 *
 *     DIDDocumentMetadata:
 *       type: object
 *       description: DID Document Metadata
 *       properties:
 *         created:
 *           type: string
 *           format: date-time
 *           description: When the DID was created
 *         updated:
 *           type: string
 *           format: date-time
 *           description: When the DID was last updated
 *         deactivated:
 *           type: boolean
 *           example: false
 *           description: Whether the DID is deactivated
 *         versionId:
 *           type: string
 *           description: Version identifier
 *
 *     DIDResolutionMetadata:
 *       type: object
 *       description: DID Resolution Metadata
 *       properties:
 *         contentType:
 *           type: string
 *           example: "application/did+ld+json"
 *           description: Content type of the DID Document
 *         error:
 *           type: string
 *           enum: [notFound, invalidDid, representationNotSupported]
 *           description: Error code if resolution failed
 *         retrieved:
 *           type: string
 *           format: date-time
 *           description: When the DID Document was retrieved
 *
 *     DIDResolutionResult:
 *       type: object
 *       description: W3C DID Resolution Result
 *       properties:
 *         didDocument:
 *           oneOf:
 *             - $ref: '#/components/schemas/DIDDocument'
 *             - type: 'null'
 *           description: The resolved DID Document (null if not found)
 *         didDocumentMetadata:
 *           $ref: '#/components/schemas/DIDDocumentMetadata'
 *         didResolutionMetadata:
 *           $ref: '#/components/schemas/DIDResolutionMetadata'
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
 *       1. Verify ownership using JWT token authentication
 *       2. Validate new public key format (hex only, no 0x)
 *       3. Update key on blockchain
 *       4. Update DID document
 *
 *       **Important:** Authentication is handled via JWT token in Authorization header.
 *     tags:
 *       - DID Management
 *     security:
 *       - bearerAuth: []
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
 *             properties:
 *               new_public_key:
 *                 type: string
 *                 pattern: '^[a-fA-F0-9]{66,130}$'
 *                 example: "04f6e5d4c3b2a19876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba98"
 *                 description: New public key hex string WITHOUT 0x prefix (66 or 130 hex chars)
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
router.put(
  "/:did/key-rotation",
  verifyDIDSignature,
  keyRotationValidator,
  did.keyRotation
);

/**
 * @swagger
 * /dids/{did}:
 *   delete:
 *     summary: Deactivate DID (User)
 *     description: |
 *       Deactivate a DID on the blockchain. Requires DID signature authentication via JWT token.
 *       All VCs owned by this DID will be automatically revoked.
 *
 *       **DID Format:** `did:dcert:[i/u][44 chars]` (55 chars total)
 *       - Characters allowed: a-z, A-Z, 0-9, _ (underscore), - (hyphen)
 *
 *       **Deactivation process:**
 *       1. Verify JWT token contains valid DID signature
 *       2. Query all VCs owned by the holder (from IssuerVCData table)
 *       3. Create revoke requests to each issuer (encrypted with issuer's public key)
 *       4. Mark DID as deactivated on blockchain
 *       5. **Important:** Deactivation is permanent and cannot be reversed
 *       6. **Note:** VCs will be revoked after issuer approves the revoke requests
 *
 *       **Use cases:**
 *       - Account closure
 *       - Security breach
 *       - Organizational changes
 *     tags:
 *       - DID Management
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: did
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^did:dcert:[iu](?:[a-zA-Z0-9_-]{44}|[a-zA-Z0-9_-]{87})$'
 *         example: "did:dcert:iABCD1234567890-xyz_12345678901234567890abcd"
 *         description: DID to deactivate (55 chars total)
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
 *                   example: "DID deactivated successfully. 3 revoke requests have been created."
 *                 data:
 *                   type: object
 *                   properties:
 *                     found:
 *                       type: boolean
 *                       example: true
 *                     message:
 *                       type: string
 *                       example: "DID deactivated successfully. 3 revoke requests have been created."
 *                     did:
 *                       type: string
 *                       example: "did:dcert:iABCD1234567890-xyz_12345678901234567890abcd"
 *                     revokeRequestsCount:
 *                       type: integer
 *                       example: 3
 *                       description: Number of revoke requests that were created
 *                     transactionHash:
 *                       type: string
 *                       example: "fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210"
 *                     blockNumber:
 *                       type: integer
 *                       example: 12347
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized (Invalid or missing JWT token)
 *       404:
 *         description: DID not found
 *       500:
 *         description: Internal server error or blockchain failure
 */
router.delete("/:did", verifyDIDSignature, deleteDIDValidator, did.deleteDID);

/**
 * @swagger
 * /dids/admin/{did}:
 *   delete:
 *     summary: Deactivate DID (Admin)
 *     description: |
 *       Admin endpoint to deactivate a DID on the blockchain.
 *       All VCs owned by this DID will be automatically revoked.
 *
 *       **DID Format:** `did:dcert:[i/u][44 chars]` (55 chars total)
 *
 *       **Deactivation process:**
 *       1. Verify admin authentication
 *       2. Query all VCs owned by the holder (from IssuerVCData table)
 *       3. Create revoke requests to each issuer (encrypted with issuer's public key)
 *       4. Mark DID as deactivated on blockchain
 *       5. **Important:** Deactivation is permanent and cannot be reversed
 *       6. **Note:** VCs will be revoked after issuer approves the revoke requests
 *
 *       **Use cases:**
 *       - Admin-initiated account deactivation
 *       - Security enforcement
 *       - Compliance requirements
 *     tags:
 *       - DID Management
 *     security:
 *       - AdminBearerAuth: []
 *     parameters:
 *       - in: path
 *         name: did
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^did:dcert:[iu](?:[a-zA-Z0-9_-]{44}|[a-zA-Z0-9_-]{87})$'
 *         example: "did:dcert:iABCD1234567890-xyz_12345678901234567890abcd"
 *         description: DID to deactivate (55 chars total)
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
 *                   example: "DID deactivated successfully by admin. 3 revoke requests have been created."
 *                 data:
 *                   type: object
 *                   properties:
 *                     found:
 *                       type: boolean
 *                       example: true
 *                     message:
 *                       type: string
 *                       example: "DID deactivated successfully. 3 revoke requests have been created."
 *                     did:
 *                       type: string
 *                       example: "did:dcert:iABCD1234567890-xyz_12345678901234567890abcd"
 *                     revokeRequestsCount:
 *                       type: integer
 *                       example: 3
 *                       description: Number of revoke requests that were created
 *                     transactionHash:
 *                       type: string
 *                       example: "fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210"
 *                     blockNumber:
 *                       type: integer
 *                       example: 12347
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized (Invalid or missing admin token)
 *       404:
 *         description: DID not found
 *       500:
 *         description: Internal server error or blockchain failure
 */
router.delete(
  "/admin/:did",
  adminAuthMiddleware,
  deleteDIDByAdminValidator,
  did.deleteDIDByAdmin
);

/**
 * @swagger
 * /dids/{did}/document:
 *   get:
 *     summary: Get DID Document (W3C Compliant)
 *     description: |
 *       Retrieve the complete W3C DID Document following the DID Core Specification.
 *
 *       **DID Format:** `did:dcert:[i/u][44 chars]` or `did:dcert:[i/u][87 chars]`
 *       - Characters allowed: a-z, A-Z, 0-9, _ (underscore), - (hyphen)
 *
 *       **Response Structure (W3C DID Resolution Result):**
 *       - `didDocument`: The resolved DID Document (null if not found)
 *       - `didDocumentMetadata`: Metadata about the DID Document
 *       - `didResolutionMetadata`: Metadata about the resolution process
 *
 *       **DID Document Contents:**
 *       - `@context`: JSON-LD context for semantic interoperability
 *       - `id`: The DID identifier
 *       - `controller`: The DID controller
 *       - `verificationMethod`: Array of public keys
 *       - `authentication`: References to keys for authentication
 *       - `assertionMethod`: References to keys for VC signing
 *       - `service`: Service endpoints (for institutional DIDs)
 *
 *       **Standards:**
 *       - W3C DID Core Specification v1.1
 *       - W3C DID Resolution
 *       - EcdsaSecp256k1VerificationKey2019 for key type
 *     tags:
 *       - DID Management
 *     parameters:
 *       - in: path
 *         name: did
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^did:dcert:[iu](?:[a-zA-Z0-9_-]{44}|[a-zA-Z0-9_-]{87})$'
 *         example: "did:dcert:uBI57YIz1cgJ_iHkIYt-CDGDlU10y0khtjFH31PSP3iPN1hOEZxd3fodVKefn4eeipAyomLxY8lEl6GIZiBBEIys"
 *         description: DID to resolve
 *     responses:
 *       200:
 *         description: DID Resolution Result
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
 *                   example: "DID document retrieved successfully"
 *                 data:
 *                   $ref: '#/components/schemas/DIDResolutionResult'
 *             examples:
 *               individualDID:
 *                 summary: Individual DID Document Found
 *                 value:
 *                   success: true
 *                   message: "DID document retrieved successfully"
 *                   data:
 *                     didDocument:
 *                       "@context":
 *                         - "https://www.w3.org/ns/did/v1.1"
 *                         - "https://w3id.org/security/suites/secp256k1-2019/v1"
 *                       id: "did:dcert:uBI57YIz1cgJ_iHkIYt-CDGDlU10y0khtjFH31PSP3iPN1hOEZxd3fodVKefn4eeipAyomLxY8lEl6GIZiBBEIys"
 *                       controller: "did:dcert:uBI57YIz1cgJ_iHkIYt-CDGDlU10y0khtjFH31PSP3iPN1hOEZxd3fodVKefn4eeipAyomLxY8lEl6GIZiBBEIys"
 *                       verificationMethod:
 *                         - id: "did:dcert:uBI57YIz1cgJ_iHkIYt-CDGDlU10y0khtjFH31PSP3iPN1hOEZxd3fodVKefn4eeipAyomLxY8lEl6GIZiBBEIys#key-1"
 *                           type: "EcdsaSecp256k1VerificationKey2019"
 *                           controller: "did:dcert:uBI57YIz1cgJ_iHkIYt-CDGDlU10y0khtjFH31PSP3iPN1hOEZxd3fodVKefn4eeipAyomLxY8lEl6GIZiBBEIys"
 *                           publicKeyHex: "044e78e5591ac4f0af85d92982cff7d00e0aad04e333063e56f1a1893507e9cc9b63a5d8948975d6483d0526940f2d82556a42353820a728f834e56fadca3a2b38"
 *                       authentication:
 *                         - "did:dcert:uBI57YIz1cgJ_iHkIYt-CDGDlU10y0khtjFH31PSP3iPN1hOEZxd3fodVKefn4eeipAyomLxY8lEl6GIZiBBEIys#key-1"
 *                       assertionMethod:
 *                         - "did:dcert:uBI57YIz1cgJ_iHkIYt-CDGDlU10y0khtjFH31PSP3iPN1hOEZxd3fodVKefn4eeipAyomLxY8lEl6GIZiBBEIys#key-1"
 *                     didDocumentMetadata:
 *                       deactivated: false
 *                     didResolutionMetadata:
 *                       contentType: "application/did+ld+json"
 *                       retrieved: "2026-01-22T10:30:00.000Z"
 *               institutionalDID:
 *                 summary: Institutional DID Document Found
 *                 value:
 *                   success: true
 *                   message: "DID document retrieved successfully"
 *                   data:
 *                     didDocument:
 *                       "@context":
 *                         - "https://www.w3.org/ns/did/v1.1"
 *                         - "https://w3id.org/security/suites/secp256k1-2019/v1"
 *                       id: "did:dcert:iUniversityXYZ_1234567890abcdef1234567890abcd"
 *                       controller: "did:dcert:iUniversityXYZ_1234567890abcdef1234567890abcd"
 *                       verificationMethod:
 *                         - id: "did:dcert:iUniversityXYZ_1234567890abcdef1234567890abcd#key-1"
 *                           type: "EcdsaSecp256k1VerificationKey2019"
 *                           controller: "did:dcert:iUniversityXYZ_1234567890abcdef1234567890abcd"
 *                           publicKeyHex: "04a1b2c3d4e5f6789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcd"
 *                       authentication:
 *                         - "did:dcert:iUniversityXYZ_1234567890abcdef1234567890abcd#key-1"
 *                       assertionMethod:
 *                         - "did:dcert:iUniversityXYZ_1234567890abcdef1234567890abcd#key-1"
 *                       service:
 *                         - id: "did:dcert:iUniversityXYZ_1234567890abcdef1234567890abcd#institution-profile"
 *                           type: "InstitutionProfile"
 *                           serviceEndpoint:
 *                             name: "Universitas Indonesia"
 *                             email: "admin@ui.ac.id"
 *                             phone: "+6281234567890"
 *                             country: "Indonesia"
 *                             website: "https://ui.ac.id"
 *                             address: "Depok, West Java, Indonesia"
 *                         - id: "did:dcert:iUniversityXYZ_1234567890abcdef1234567890abcd#linked-domain"
 *                           type: "LinkedDomains"
 *                           serviceEndpoint: "https://ui.ac.id"
 *                     didDocumentMetadata:
 *                       deactivated: false
 *                     didResolutionMetadata:
 *                       contentType: "application/did+ld+json"
 *                       retrieved: "2026-01-22T10:30:00.000Z"
 *               notFound:
 *                 summary: DID Not Found
 *                 value:
 *                   success: true
 *                   message: "DID not found on blockchain"
 *                   data:
 *                     didDocument: null
 *                     didDocumentMetadata:
 *                       deactivated: false
 *                     didResolutionMetadata:
 *                       error: "notFound"
 *                       retrieved: "2026-01-22T10:30:00.000Z"
 *       500:
 *         description: Internal server error or blockchain failure
 */
router.get("/:did/document", getDIDDocumentValidator, did.getDIDDocument);

export default router;
