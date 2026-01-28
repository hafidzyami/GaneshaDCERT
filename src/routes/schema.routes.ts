import express, { Router } from "express";
import * as vcSchema from "../controllers/schema.controller";
import {
  getAllVCSchemasValidator,
  getLatestSchemaVersionValidator,
  getAllSchemaVersionsValidator,
  getAllVersionsByIdValidator,
  getSchemaByIdAndVersionValidator,
  getSchemaByIdValidator,
  createVCSchemaValidator,
  updateVCSchemaValidator,
  deactivateVCSchemaValidator,
  reactivateVCSchemaValidator,
  deleteVCSchemaValidator,
  isSchemaActiveValidator,
  createVCSchemaPriceValidator,
  updateVCSchemaPriceValidator,
} from "../validators/schema.validator";
import {
  uploadOptionalImage,
  requireImageFile,
  requireImageOrLink,
} from "../middlewares/upload.middleware";
import { parseSchemaJson } from "../middlewares/parseMultipartJson.middleware";
import { verifyDIDSignature, adminAuthMiddleware } from "../middlewares";

const router: Router = express.Router();

/**
 * @swagger
 * tags:
 *   name: VC Schema Management
 *   description: Verifiable Credential schema management endpoints
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     VCSchema:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           description: Unique identifier for the schema
 *           example: "550e8400-e29b-41d4-a716-446655440000"
 *         name:
 *           type: string
 *           minLength: 3
 *           maxLength: 255
 *           description: Name of the schema
 *           example: "Diploma Certificate"
 *         schema:
 *           type: object
 *           description: JSON schema defining credential structure
 *           example:
 *             type: object
 *             properties:
 *               studentName:
 *                 type: string
 *               major:
 *                 type: string
 *               graduationYear:
 *                 type: number
 *         issuer_did:
 *           type: string
 *           pattern: '^did:dcert:[iu](?:[a-zA-Z0-9_-]{44}|[a-zA-Z0-9_-]{87})$'
 *           description: DID of the issuer (55 chars total - did:dcert:[i/u] + 44 identifier chars)
 *           example: "did:dcert:iABCD1234567890-xyz_12345678901234567890abcd"
 *         version:
 *           type: integer
 *           minimum: 1
 *           description: Schema version number
 *           example: 1
 *         image_link:
 *           type: string
 *           format: uri
 *           description: URL to the background image for the VC schema (optional)
 *           example: "https://minio.example.com/bucket/background/uuid-filename?X-Amz-..."
 *         isActive:
 *           type: boolean
 *           description: Whether the schema is active
 *           example: true
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Creation timestamp
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: Last update timestamp
 */

// ============================================
// 🔹 GET ENDPOINTS (Database Only - Fast)
// ============================================

/**
 * @swagger
 * /schemas:
 *   get:
 *     summary: Get all VC schemas
 *     description: |
 *       Retrieve all VC schemas from database with optional filters (READ from Database only).
 *
 *       **Filters:**
 *       - Filter by issuer DID (institution only)
 *       - Show active, inactive, or all schemas
 *
 *       **DID Format:** `did:dcert:[i/u][44 chars]`
 *       - Characters allowed: a-z, A-Z, 0-9, _ (underscore), - (hyphen)
 *     tags:
 *       - VC Schema Management
 *     parameters:
 *       - in: query
 *         name: issuerDid
 *         schema:
 *           type: string
 *           pattern: '^did:dcert:[iu](?:[a-zA-Z0-9_-]{44}|[a-zA-Z0-9_-]{87})$'
 *         description: Filter by issuer DID (format did:dcert:[i/u][44 chars])
 *         example: "did:dcert:iABCD1234567890-xyz_12345678901234567890abcd"
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *         description: Filter to show active, inactive, or all schemas
 *         example: true
 *       - in: query
 *         name: pricingOnly
 *         schema:
 *           type: boolean
 *         description: Filter to show all or pricing schemas
 *         required: false
 *     responses:
 *       200:
 *         description: List of VC schemas retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 count:
 *                   type: integer
 *                   description: Number of schemas returned
 *                   example: 5
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/VCSchema'
 *       400:
 *         description: Invalid query parameters
 *       500:
 *         description: Internal server error
 */
router.get("/", getAllVCSchemasValidator, vcSchema.getAllVCSchemas);

/**
 * @swagger
 * /schemas/blockchain:
 *   get:
 *     summary: Get all VC schemas from blockchain with pagination
 *     description: |
 *       Retrieve VC schemas directly from blockchain with pagination support (Direct blockchain query - slower but always up-to-date).
 *
 *       **Note:** This endpoint queries blockchain directly, so it may be slower than the RDBMS endpoint but guarantees the latest data.
 *
 *       **Pagination:** Supports page-based navigation with configurable page size.
 *
 *       **Filtering:** Can return all versions or only latest versions per schema.
 *     tags:
 *       - VC Schema Management
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number (starts from 1)
 *         example: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 1000
 *           default: 100
 *         description: Number of items per page (max 1000)
 *         example: 100
 *       - in: query
 *         name: latestOnly
 *         schema:
 *           type: boolean
 *           default: true
 *         description: Return only latest versions of each schema
 *         example: true
 *     responses:
 *       200:
 *         description: Paginated list of VC schemas from blockchain
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
 *                   example: blockchain
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
 *                         example: "{\"type\":\"object\",\"properties\":{}}"
 *                       issuerDID:
 *                         type: string
 *                         example: "did:dcert:iABCD1234567890"
 *                       imageLink:
 *                         type: string
 *                         example: "https://example.com/image.png"
 *                       version:
 *                         type: integer
 *                         example: 1
 *                       isActive:
 *                         type: boolean
 *                         example: true
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                       example: 1
 *                     limit:
 *                       type: integer
 *                       example: 100
 *                     total:
 *                       type: integer
 *                       example: 250
 *                     returned:
 *                       type: integer
 *                       example: 100
 *                     totalPages:
 *                       type: integer
 *                       example: 3
 *                     hasNextPage:
 *                       type: boolean
 *                       example: true
 *                     hasPrevPage:
 *                       type: boolean
 *                       example: false
 *       500:
 *         description: Internal server error
 */
router.get("/blockchain", vcSchema.getAllVCSchemasFromBlockchain);

/**
 * @swagger
 * /schemas/blockchain/count:
 *   get:
 *     summary: Get total count of schemas from blockchain
 *     description: |
 *       Get the total count of all schema versions stored in the blockchain.
 *     tags:
 *       - VC Schema Management
 *     responses:
 *       200:
 *         description: Total count retrieved successfully
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
 *                 count:
 *                   type: integer
 *                   example: 42
 *       500:
 *         description: Internal server error
 */
router.get("/blockchain/count", vcSchema.getSchemasCountFromBlockchain);

/**
 * @swagger
 * /schemas/blockchain/{id}/version/{version}:
 *   get:
 *     summary: Get specific schema version from blockchain
 *     description: |
 *       Get a specific version of a schema by ID and version number from blockchain.
 *     tags:
 *       - VC Schema Management
 *     parameters:
 *       - in: path
 *         name: id
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
 *         example: 2
 *     responses:
 *       200:
 *         description: Schema retrieved successfully
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
 *                       example: "{\"type\":\"object\",\"properties\":{}}"
 *                     issuerDID:
 *                       type: string
 *                       example: "did:dcert:iABCD1234567890"
 *                     version:
 *                       type: integer
 *                       example: 2
 *                     isActive:
 *                       type: boolean
 *                       example: true
 *       404:
 *         description: Schema not found
 *       500:
 *         description: Internal server error
 */
router.get(
  "/blockchain/:id/version/:version",
  vcSchema.getSchemaFromBlockchain,
);

/**
 * @swagger
 * /schemas/blockchain/{id}/latest:
 *   get:
 *     summary: Get latest schema version from blockchain
 *     description: |
 *       Get the latest version of a schema by ID from blockchain.
 *     tags:
 *       - VC Schema Management
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Schema ID
 *         example: "did:dcert:schema:diploma_certificate"
 *     responses:
 *       200:
 *         description: Latest schema version retrieved successfully
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
 *                       example: "{\"type\":\"object\",\"properties\":{}}"
 *                     issuerDID:
 *                       type: string
 *                       example: "did:dcert:iABCD1234567890"
 *                     version:
 *                       type: integer
 *                       example: 3
 *                     isActive:
 *                       type: boolean
 *                       example: true
 *       404:
 *         description: Schema not found
 *       500:
 *         description: Internal server error
 */
router.get("/blockchain/:id/latest", vcSchema.getLatestSchemaFromBlockchain);

/**
 * @swagger
 * /schemas/latest:
 *   get:
 *     summary: Get latest schema version
 *     description: |
 *       Get the latest version of a schema by name and issuer DID (READ from Database only).
 *
 *       **Use Case:** Get current active version of a credential schema.
 *
 *       **DID Format:** `did:dcert:[i/u][44 chars]`
 *       - Characters allowed: a-z, A-Z, 0-9, _ (underscore), - (hyphen)
 *     tags:
 *       - VC Schema Management
 *     parameters:
 *       - in: query
 *         name: name
 *         required: true
 *         schema:
 *           type: string
 *           minLength: 3
 *           maxLength: 255
 *         description: Schema name (3-255 characters)
 *         example: "Diploma Certificate"
 *       - in: query
 *         name: issuerDid
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^did:dcert:[iu](?:[a-zA-Z0-9_-]{44}|[a-zA-Z0-9_-]{87})$'
 *         description: Issuer DID (format did:dcert:[i/u][44 chars])
 *         example: "did:dcert:iABCD1234567890-xyz_12345678901234567890abcd"
 *     responses:
 *       200:
 *         description: Latest schema version retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/VCSchema'
 *       400:
 *         description: Missing or invalid parameters
 *       404:
 *         description: Schema not found
 *       500:
 *         description: Internal server error
 */
router.get(
  "/latest",
  getLatestSchemaVersionValidator,
  vcSchema.getLatestSchemaVersion,
);

/**
 * @swagger
 * /schemas/versions:
 *   get:
 *     summary: Get all schema versions
 *     description: |
 *       Get all versions of a specific schema by name and issuer DID (READ from Database only).
 *
 *       **Use Case:** View version history of a credential schema.
 *
 *       **DID Format:** `did:dcert:[i/u][44 chars]`
 *       - Characters allowed: a-z, A-Z, 0-9, _ (underscore), - (hyphen)
 *     tags:
 *       - VC Schema Management
 *     parameters:
 *       - in: query
 *         name: name
 *         required: true
 *         schema:
 *           type: string
 *           minLength: 3
 *           maxLength: 255
 *         description: Schema name (3-255 characters)
 *         example: "Diploma Certificate"
 *       - in: query
 *         name: issuerDid
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^did:dcert:[iu](?:[a-zA-Z0-9_-]{44}|[a-zA-Z0-9_-]{87})$'
 *         description: Issuer DID (format did:dcert:[i/u][44 chars])
 *         example: "did:dcert:iABCD1234567890-xyz_12345678901234567890abcd"
 *     responses:
 *       200:
 *         description: All schema versions retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 count:
 *                   type: integer
 *                   description: Number of versions
 *                   example: 3
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/VCSchema'
 *       400:
 *         description: Missing or invalid parameters
 *       404:
 *         description: Schema not found
 *       500:
 *         description: Internal server error
 */
router.get(
  "/versions",
  getAllSchemaVersionsValidator,
  vcSchema.getAllSchemaVersions,
);

/**
 * @swagger
 * /schemas/{id}/versions:
 *   get:
 *     summary: Get all versions of a schema by ID
 *     description: |
 *       Retrieve all versions of a specific schema by its UUID (READ from Database only).
 *
 *       **Use Case:** View version history of a schema based on ID only.
 *
 *       **Returns:** All versions sorted by version number (descending - newest first)
 *     tags:
 *       - VC Schema Management
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Schema UUID
 *         example: "550e8400-e29b-41d4-a716-446655440000"
 *     responses:
 *       200:
 *         description: All schema versions retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 count:
 *                   type: integer
 *                   description: Number of versions found
 *                   example: 3
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/VCSchema'
 *       400:
 *         description: Invalid UUID format
 *       404:
 *         description: Schema not found
 *       500:
 *         description: Internal server error
 */
router.get(
  "/:id/versions",
  getAllVersionsByIdValidator,
  vcSchema.getAllVersionsById,
);

/**
 * @swagger
 * /schemas/{id}/version/{version}:
 *   get:
 *     summary: Get schema by ID and Version
 *     description: |
 *       Retrieve a specific schema by its UUID and version number (READ from Database only).
 *
 *       **Use Case:** Get exact version of a schema.
 *
 *       **Both parameters are required.**
 *     tags:
 *       - VC Schema Management
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Schema UUID
 *         example: "550e8400-e29b-41d4-a716-446655440000"
 *       - in: path
 *         name: version
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Schema version number
 *         example: 2
 *     responses:
 *       200:
 *         description: Schema retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/VCSchema'
 *       400:
 *         description: Invalid UUID or version format
 *       404:
 *         description: Schema version not found
 *       500:
 *         description: Internal server error
 */
router.get(
  "/:id/version/:version",
  getSchemaByIdAndVersionValidator,
  vcSchema.getSchemaByIdAndVersion,
);

/**
 * @swagger
 * /schemas/{id}/version/{version}/active:
 *   get:
 *     summary: Check if schema version is active
 *     description: Check the active status of a specific schema version (READ from Database only)
 *     tags:
 *       - VC Schema Management
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Schema UUID
 *         example: "550e8400-e29b-41d4-a716-446655440000"
 *       - in: path
 *         name: version
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Schema version number
 *         example: 1
 *     responses:
 *       200:
 *         description: Schema status retrieved successfully
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
 *                     id:
 *                       type: string
 *                       format: uuid
 *                       example: "550e8400-e29b-41d4-a716-446655440000"
 *                     version:
 *                       type: integer
 *                       example: 1
 *                     isActive:
 *                       type: boolean
 *                       example: true
 *       400:
 *         description: Invalid UUID or version format
 *       404:
 *         description: Schema version not found
 *       500:
 *         description: Internal server error
 */
router.get(
  "/:id/version/:version/active",
  isSchemaActiveValidator,
  vcSchema.isSchemaActive,
);

// /**
//  * @swagger
//  * /schemas/price:
//  *   post:
//  *     summary: Create VC schema price
//  *     description: Create a new price entry for a VC schema
//  *     tags: [VC Schema Management]
//  *     requestBody:
//  *       required: true
//  *       content:
//  *         application/json:
//  *           schema:
//  *             type: object
//  *             required:
//  *               - schemaId
//  *               - price
//  *               - currency
//  *               - issuerId
//  *               - version
//  *             properties:
//  *               schemaId:
//  *                 type: string
//  *                 format: uuid
//  *                 description: Schema ID
//  *                 example: "550e8400-e29b-41d4-a716-446655440000"
//  *               price:
//  *                 type: number
//  *                 minimum: 0
//  *                 description: Price amount
//  *                 example: 50000
//  *               currency:
//  *                 type: string
//  *                 minLength: 3
//  *                 maxLength: 3
//  *                 description: Currency code (3 letters)
//  *                 example: "IDR"
//  *               issuerId:
//  *                 type: string
//  *                 format: uuid
//  *                 description: Issuer ID
//  *                 example: "660e8400-e29b-41d4-a716-446655440001"
//  *               version:
//  *                 type: integer
//  *                 description: Schema version number
//  *                 example: 1
//  *     responses:
//  *       200:
//  *         description: Schema price created successfully
//  *       400:
//  *         description: Validation error or creation failed
//  *       500:
//  *         description: Internal server error
//  */
// router.post(
//   "/price",
//   // adminAuthMiddleware,
//   createVCSchemaPriceValidator,
//   vcSchema.createVCSchemaPrice
// );

/**
 * @swagger
 * /schemas/price:
 *   put:
 *     summary: Update VC schema price
 *     description: Update an existing price entry for a VC schema
 *     tags: [VC Schema Management]
 *     security:
 *       - AdminBearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - schemaId
 *               - price
 *               - currency
 *               - issuerId
 *               - version
 *             properties:
 *               schemaId:
 *                 type: string
 *                 format: uuid
 *                 description: Schema ID
 *                 example: "550e8400-e29b-41d4-a716-446655440000"
 *               price:
 *                 type: number
 *                 minimum: 0
 *                 description: New price amount
 *                 example: 75000
 *               currency:
 *                 type: string
 *                 minLength: 3
 *                 maxLength: 3
 *                 description: Currency code (3 letters)
 *                 example: "IDR"
 *               issuerId:
 *                 type: string
 *                 format: uuid
 *                 description: Issuer ID
 *                 example: "660e8400-e29b-41d4-a716-446655440001"
 *               version:
 *                 type: integer
 *                 description: Schema version number
 *                 example: 1
 *     responses:
 *       200:
 *         description: Schema price updated successfully
 *       400:
 *         description: Validation error
 *       404:
 *         description: Schema price not found
 *       500:
 *         description: Internal server error
 */
router.put(
  "/price",
  adminAuthMiddleware,
  updateVCSchemaPriceValidator,
  vcSchema.updateVCSchemaPrice,
);

/**
 * @swagger
 * /schemas/allprices:
 *   get:
 *     summary: Get all VC schema prices
 *     description: Retrieve all price entries for VC schemas
 *     tags: [VC Schema Management]
 *     security:
 *       - AdminBearerAuth: []
 *     responses:
 *       200:
 *         description: List of all schema prices
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 count:
 *                   type: integer
 *                   description: Number of price entries
 *                   example: 10
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       schemaId:
 *                         type: string
 *                         format: uuid
 *                         example: "550e8400-e29b-41d4-a716-446655440000"
 *                       price:
 *                         type: number
 *                         example: 50000
 *                       currency:
 *                         type: string
 *                         example: "IDR"
 *                       issuerId:
 *                         type: string
 *                         format: uuid
 *                         example: "660e8400-e29b-41d4-a716-446655440001"
 *                       version:
 *                         type: integer
 *                         example: 1
 *       500:
 *         description: Internal server error
 */
router.get("/allprices", adminAuthMiddleware, vcSchema.getAllVCSchemaPrices);

// ============================================
// 🔹 POST/PUT/PATCH/DELETE ENDPOINTS (Database + Blockchain)
// ============================================

/**
 * @swagger
 * /schemas:
 *   post:
 *     summary: Create new VC schema
 *     description: |
 *       Create a new VC schema (version 1) in both Database and Blockchain.
 *
 *       **Important:**
 *       - Schema name must be 3-255 characters
 *       - Schema must have 'type' property
 *       - Object schemas must have 'properties'
 *       - Issuer DID format: did:dcert:[i/u][44 chars]
 *       - Only institutions (prefix 'i') can create schemas
 *
 *       **DID Format Rules:**
 *       - Pattern: `did:dcert:[i/u][44 chars]` (55 chars total)
 *       - Prefix 'i' for institution (required), 'u' for individual
 *       - Characters allowed: a-z, A-Z, 0-9, _ (underscore), - (hyphen)
 *       - Example: `did:dcert:iABCD1234567890-xyz_12345678901234567890abcd`
 *     tags:
 *       - VC Schema Management
 *     security:
 *       - HolderBearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - schema
 *               - issuer_did
 *               - image
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 3
 *                 maxLength: 255
 *                 description: Name of the credential schema
 *                 example: "Diploma Certificate"
 *               schema:
 *                 type: string
 *                 description: JSON schema defining credential structure (as stringified JSON)
 *                 example: '{"type":"object","properties":{"studentName":{"type":"string"},"studentId":{"type":"string"},"major":{"type":"string"},"graduationYear":{"type":"number"}},"required":["studentName","studentId","major","graduationYear"]}'
 *               image:
 *                 type: string
 *                 format: binary
 *                 description: |
 *                   **Required** background image for the VC schema (JPEG, PNG, GIF, WEBP, max 5MB).
 *                   This image will be used as the credential background.
 *               issuer_did:
 *                 type: string
 *                 pattern: '^did:dcert:i[a-zA-Z0-9_-]{44}$'
 *                 description: DID of institution issuer (must start with 'i' followed by 44 chars)
 *                 example: "did:dcert:iABCD1234567890-xyz_12345678901234567890abcd"
 *           examples:
 *             diplomaSchema:
 *               summary: Diploma Certificate Schema
 *               value:
 *                 name: "Diploma Certificate"
 *                 schema: '{"type":"object","properties":{"studentName":{"type":"string","description":"Full name of the student"},"studentId":{"type":"string","description":"Student ID number"},"major":{"type":"string","description":"Field of study"},"graduationYear":{"type":"number","description":"Year of graduation"},"gpa":{"type":"number","minimum":0,"maximum":4}},"required":["studentName","studentId","major","graduationYear"]}'
 *                 issuer_did: "did:dcert:iABCD1234567890-xyz_12345678901234567890abcd"
 *             employmentSchema:
 *               summary: Employment Certificate Schema
 *               value:
 *                 name: "Employment Certificate"
 *                 schema: '{"type":"object","properties":{"employeeName":{"type":"string"},"employeeId":{"type":"string"},"position":{"type":"string"},"department":{"type":"string"},"startDate":{"type":"string","format":"date"},"endDate":{"type":"string","format":"date"}},"required":["employeeName","employeeId","position","startDate"]}'
 *                 issuer_did: "did:dcert:iXYZ9876543210-company_ABC123456789012345678"
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - schema
 *               - issuer_did
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 3
 *                 maxLength: 255
 *                 description: Name of the credential schema
 *                 example: "Diploma Certificate"
 *               schema:
 *                 type: object
 *                 description: JSON schema defining credential structure
 *                 example:
 *                   type: object
 *                   properties:
 *                     studentName:
 *                       type: string
 *                       description: Full name of the student
 *                     studentId:
 *                       type: string
 *                       description: Student ID number
 *                     major:
 *                       type: string
 *                       description: Field of study
 *                     graduationYear:
 *                       type: number
 *                       description: Year of graduation
 *                     gpa:
 *                       type: number
 *                       minimum: 0
 *                       maximum: 4
 *                   required: ["studentName", "studentId", "major", "graduationYear"]
 *               issuer_did:
 *                 type: string
 *                 pattern: '^did:dcert:i[a-zA-Z0-9_-]{44}$'
 *                 description: DID of institution issuer (must start with 'i' followed by 44 chars)
 *                 example: "did:dcert:iABCD1234567890-xyz_12345678901234567890abcd"
 *           examples:
 *             diplomaSchema:
 *               summary: Diploma Certificate Schema
 *               value:
 *                 name: "Diploma Certificate"
 *                 schema:
 *                   type: object
 *                   properties:
 *                     studentName:
 *                       type: string
 *                       description: Full name of the student
 *                     studentId:
 *                       type: string
 *                       description: Student ID number
 *                     major:
 *                       type: string
 *                       description: Field of study
 *                     graduationYear:
 *                       type: number
 *                       description: Year of graduation
 *                     gpa:
 *                       type: number
 *                       minimum: 0
 *                       maximum: 4
 *                   required: ["studentName", "studentId", "major", "graduationYear"]
 *                 issuer_did: "did:dcert:iABCD1234567890-xyz_12345678901234567890abcd"
 *             employmentSchema:
 *               summary: Employment Certificate Schema
 *               value:
 *                 name: "Employment Certificate"
 *                 schema:
 *                   type: object
 *                   properties:
 *                     employeeName:
 *                       type: string
 *                     employeeId:
 *                       type: string
 *                     position:
 *                       type: string
 *                     department:
 *                       type: string
 *                     startDate:
 *                       type: string
 *                       format: date
 *                     endDate:
 *                       type: string
 *                       format: date
 *                   required: ["employeeName", "employeeId", "position", "startDate"]
 *                 issuer_did: "did:dcert:iXYZ9876543210-company_ABC123456789012345678"
 *     responses:
 *       201:
 *         description: VC schema created successfully
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
 *                   example: "VC Schema created successfully in database and blockchain"
 *                 data:
 *                   $ref: '#/components/schemas/VCSchema'
 *                 transaction_hash:
 *                   type: string
 *                   pattern: '^[a-fA-F0-9]{64}$'
 *                   description: Blockchain transaction hash (hex without 0x prefix)
 *                   example: "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
 *       400:
 *         description: Validation error or blockchain failure
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
 *                       message:
 *                         type: string
 *             examples:
 *               invalidDID:
 *                 summary: Invalid issuer DID format
 *                 value:
 *                   success: false
 *                   message: "Validation error"
 *                   errors:
 *                     - field: "issuer_did"
 *                       message: "Invalid issuer DID format. Expected format: did:method:identifier"
 *       409:
 *         description: Schema already exists
 *       500:
 *         description: Internal server error
 */
router.post(
  "/",
  uploadOptionalImage,
  requireImageFile, // Require image for POST
  parseSchemaJson,
  verifyDIDSignature,
  createVCSchemaValidator,
  vcSchema.createVCSchema,
);

/**
 * @swagger
 * /schemas/{id}:
 *   put:
 *     summary: Update existing VC schema
 *     description: |
 *       Update an existing VC schema (creates new version) in both Database and Blockchain.
 *
 *       **Version Control:**
 *       - Each update creates a new version
 *       - Previous versions remain accessible
 *       - Version number auto-increments
 *
 *       **Important:**
 *       - Schema must have 'type' property
 *       - Object schemas must have 'properties'
 *     tags:
 *       - VC Schema Management
 *     security:
 *       - HolderBearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID of the schema to update
 *         example: "550e8400-e29b-41d4-a716-446655440000"
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - schema
 *             properties:
 *               schema:
 *                 type: string
 *                 description: Updated JSON schema structure as stringified JSON (creates new version)
 *                 example: '{"type":"object","properties":{"studentName":{"type":"string"},"studentId":{"type":"string"},"major":{"type":"string"},"graduationYear":{"type":"number"},"gpa":{"type":"number"},"honors":{"type":"string","enum":["Cum Laude","Magna Cum Laude","Summa Cum Laude"]}},"required":["studentName","studentId","major","graduationYear"]}'
 *               image:
 *                 type: string
 *                 format: binary
 *                 description: |
 *                   Background image for the VC schema (JPEG, PNG, GIF, WEBP, max 5MB).
 *                   **Image Management (for versioning):**
 *                   - **Keep existing background:** Send only `image_link` (no `image` file) - reuses same image for new version
 *                   - **Change background:** Send only `image` file (no `image_link`) - uploads new image for new version (old image kept for previous version)
 *
 *                   **Important:** Either `image` or `image_link` must be provided. You cannot update a schema without specifying a background.
 *                   **Note:** Old images are preserved in MinIO because they belong to previous schema versions.
 *               image_link:
 *                 type: string
 *                 format: uri
 *                 description: |
 *                   URL of the existing background image to keep.
 *                   Provide this (without sending `image` file) to keep the current background image.
 *                   This helps manage MinIO storage efficiently by avoiding unnecessary uploads.
 *
 *                   **Important:** Either `image` or `image_link` must be provided.
 *                 example: "https://dev-dcert.ganeshait.com/dcert-storage/background/550e8400-e29b-41d4-a716-446655440000?X-Amz-Algorithm=..."
 *           examples:
 *             addHonorsField:
 *               summary: Add honors field to diploma schema
 *               value:
 *                 schema: '{"type":"object","properties":{"studentName":{"type":"string"},"studentId":{"type":"string"},"major":{"type":"string"},"graduationYear":{"type":"number"},"gpa":{"type":"number"},"honors":{"type":"string","enum":["Cum Laude","Magna Cum Laude","Summa Cum Laude"]}},"required":["studentName","studentId","major","graduationYear"]}'
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - schema
 *             properties:
 *               schema:
 *                 type: object
 *                 description: Updated JSON schema structure (creates new version)
 *                 example:
 *                   type: object
 *                   properties:
 *                     studentName:
 *                       type: string
 *                     studentId:
 *                       type: string
 *                     major:
 *                       type: string
 *                     graduationYear:
 *                       type: number
 *                     gpa:
 *                       type: number
 *                     honors:
 *                       type: string
 *                       enum: ["Cum Laude", "Magna Cum Laude", "Summa Cum Laude"]
 *                   required: ["studentName", "studentId", "major", "graduationYear"]
 *               image_link:
 *                 type: string
 *                 format: uri
 *                 description: |
 *                   **Required** URL of the existing background image to keep when using application/json.
 *                   **Note:** When using application/json (not multipart/form-data), you can only manage existing images via image_link.
 *                   To upload a new image, use multipart/form-data instead.
 *
 *                   **Important:** This field is required when using application/json content type.
 *                 example: "https://dev-dcert.ganeshait.com/dcert-storage/background/550e8400-e29b-41d4-a716-446655440000?X-Amz-Algorithm=..."
 *           examples:
 *             addHonorsField:
 *               summary: Add honors field to diploma schema
 *               value:
 *                 schema:
 *                   type: object
 *                   properties:
 *                     studentName:
 *                       type: string
 *                     studentId:
 *                       type: string
 *                     major:
 *                       type: string
 *                     graduationYear:
 *                       type: number
 *                     gpa:
 *                       type: number
 *                     honors:
 *                       type: string
 *                       enum: ["Cum Laude", "Magna Cum Laude", "Summa Cum Laude"]
 *                   required: ["studentName", "studentId", "major", "graduationYear"]
 *     responses:
 *       200:
 *         description: VC schema updated successfully (new version created)
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
 *                   example: "VC Schema updated successfully in database and blockchain"
 *                 data:
 *                   allOf:
 *                     - $ref: '#/components/schemas/VCSchema'
 *                     - type: object
 *                       properties:
 *                         version:
 *                           type: integer
 *                           description: New version number
 *                           example: 2
 *                 transaction_hash:
 *                   type: string
 *                   pattern: '^[a-fA-F0-9]{64}$'
 *                   description: Blockchain transaction hash (hex without 0x prefix)
 *                   example: "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"
 *       400:
 *         description: Validation error or blockchain failure
 *       404:
 *         description: Schema not found
 *       500:
 *         description: Internal server error
 */
router.put(
  "/:id",
  uploadOptionalImage,
  requireImageOrLink, // Require either image or image_link for UPDATE
  parseSchemaJson,
  verifyDIDSignature,
  updateVCSchemaValidator,
  vcSchema.updateVCSchema,
);

/**
 * @swagger
 * /schemas/{id}/version/{version}/deactivate:
 *   patch:
 *     summary: Deactivate VC schema version
 *     description: |
 *       Deactivate a specific VC schema version in both Database and Blockchain.
 *
 *       **Effect:**
 *       - This specific version cannot be used for new credentials
 *       - Existing credentials remain valid
 *       - Other versions are not affected
 *     tags:
 *       - VC Schema Management
 *     security:
 *       - HolderBearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID of the schema to deactivate
 *         example: "550e8400-e29b-41d4-a716-446655440000"
 *       - in: path
 *         name: version
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Version number to deactivate
 *         example: 1
 *     responses:
 *       200:
 *         description: Schema version deactivated successfully
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
 *                   example: "VC Schema deactivated successfully"
 *                 data:
 *                   allOf:
 *                     - $ref: '#/components/schemas/VCSchema'
 *                     - type: object
 *                       properties:
 *                         isActive:
 *                           type: boolean
 *                           example: false
 *                 transaction_hash:
 *                   type: string
 *                   pattern: '^[a-fA-F0-9]{64}$'
 *                   description: Blockchain transaction hash (hex without 0x prefix)
 *                   example: "fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210"
 *       400:
 *         description: Schema version already deactivated or blockchain failure
 *       404:
 *         description: Schema version not found
 *       500:
 *         description: Internal server error
 */
router.patch(
  "/:id/version/:version/deactivate",
  deactivateVCSchemaValidator,
  verifyDIDSignature,
  vcSchema.deactivateVCSchema,
);

/**
 * @swagger
 * /schemas/{id}/version/{version}/reactivate:
 *   patch:
 *     summary: Reactivate VC schema version
 *     description: |
 *       Reactivate a deactivated VC schema version in both Database and Blockchain.
 *
 *       **Effect:**
 *       - This specific version can be used for new credentials again
 *       - Other versions are not affected
 *     tags:
 *       - VC Schema Management
 *     security:
 *       - HolderBearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID of the schema to reactivate
 *         example: "550e8400-e29b-41d4-a716-446655440000"
 *       - in: path
 *         name: version
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Version number to reactivate
 *         example: 1
 *     responses:
 *       200:
 *         description: Schema version reactivated successfully
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
 *                   example: "VC Schema reactivated successfully"
 *                 data:
 *                   allOf:
 *                     - $ref: '#/components/schemas/VCSchema'
 *                     - type: object
 *                       properties:
 *                         isActive:
 *                           type: boolean
 *                           example: true
 *                 transaction_hash:
 *                   type: string
 *                   pattern: '^[a-fA-F0-9]{64}$'
 *                   description: Blockchain transaction hash (hex without 0x prefix)
 *                   example: "abcdef9876543210abcdef9876543210abcdef9876543210abcdef9876543210"
 *       400:
 *         description: Schema version already active or blockchain failure
 *       404:
 *         description: Schema version not found
 *       500:
 *         description: Internal server error
 */
router.patch(
  "/:id/version/:version/reactivate",
  reactivateVCSchemaValidator,
  verifyDIDSignature,
  vcSchema.reactivateVCSchema,
);

export default router;
