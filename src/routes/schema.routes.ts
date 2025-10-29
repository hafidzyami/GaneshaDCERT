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
} from "../validators/schema.validator";

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
 *       - Show only active schemas
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
 *         name: activeOnly
 *         schema:
 *           type: boolean
 *         description: Filter to show only active schemas
 *         example: true
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
  vcSchema.getLatestSchemaVersion
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
  vcSchema.getAllSchemaVersions
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
  vcSchema.getAllVersionsById
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
  vcSchema.getSchemaByIdAndVersion
);

/**
 * @swagger
 * /schemas/{id}/active:
 *   get:
 *     summary: Check if schema is active
 *     description: Check the active status of a schema (READ from Database only)
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
 *                     isActive:
 *                       type: boolean
 *                       example: true
 *       400:
 *         description: Invalid UUID format
 *       404:
 *         description: Schema not found
 *       500:
 *         description: Internal server error
 */
router.get("/:id/active", isSchemaActiveValidator, vcSchema.isSchemaActive);

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
 *     requestBody:
 *       required: true
 *       content:
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
router.post("/", createVCSchemaValidator, vcSchema.createVCSchema);

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
router.put("/:id", updateVCSchemaValidator, vcSchema.updateVCSchema);

/**
 * @swagger
 * /schemas/{id}/deactivate:
 *   patch:
 *     summary: Deactivate VC schema
 *     description: |
 *       Deactivate a VC schema in both Database and Blockchain.
 *
 *       **Effect:**
 *       - Schema cannot be used for new credentials
 *       - Existing credentials remain valid
 *     tags:
 *       - VC Schema Management
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID of the schema to deactivate
 *         example: "550e8400-e29b-41d4-a716-446655440000"
 *     responses:
 *       200:
 *         description: Schema deactivated successfully
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
 *         description: Schema already deactivated or blockchain failure
 *       404:
 *         description: Schema not found
 *       500:
 *         description: Internal server error
 */
router.patch(
  "/:id/deactivate",
  deactivateVCSchemaValidator,
  vcSchema.deactivateVCSchema
);

/**
 * @swagger
 * /schemas/{id}/reactivate:
 *   patch:
 *     summary: Reactivate VC schema
 *     description: Reactivate a deactivated VC schema in both Database and Blockchain
 *     tags:
 *       - VC Schema Management
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID of the schema to reactivate
 *         example: "550e8400-e29b-41d4-a716-446655440000"
 *     responses:
 *       200:
 *         description: Schema reactivated successfully
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
 *         description: Schema already active or blockchain failure
 *       404:
 *         description: Schema not found
 *       500:
 *         description: Internal server error
 */
router.patch(
  "/:id/reactivate",
  reactivateVCSchemaValidator,
  vcSchema.reactivateVCSchema
);

export default router;
