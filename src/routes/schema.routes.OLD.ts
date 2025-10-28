// import express, { Router } from "express";
// import * as vcSchema from "../controllers/schema.controller";
// import {
//   getAllVCSchemasValidator,
//   getLatestSchemaVersionValidator,
//   getAllSchemaVersionsValidator,
//   getSchemaByIdValidator,
//   createVCSchemaValidator,
//   updateVCSchemaValidator,
//   deactivateVCSchemaValidator,
//   reactivateVCSchemaValidator,
//   deleteVCSchemaValidator,
//   isSchemaActiveValidator,
// } from "../validators/schema.validator";

// const router: Router = express.Router();

// /**
//  * @swagger
//  * tags:
//  *   name: VC Schema Management
//  *   description: Verifiable Credential schema management endpoints (Database + Blockchain)
//  */

// /**
//  * @swagger
//  * components:
//  *   schemas:
//  *     VCSchema:
//  *       type: object
//  *       properties:
//  *         id:
//  *           type: string
//  *           format: uuid
//  *           description: Unique identifier for the schema
//  *           example: "550e8400-e29b-41d4-a716-446655440000"
//  *         name:
//  *           type: string
//  *           minLength: 3
//  *           maxLength: 255
//  *           description: Name of the schema
//  *           example: "Diploma Certificate"
//  *         schema:
//  *           type: object
//  *           description: JSON schema defining credential structure
//  *           example:
//  *             type: object
//  *             properties:
//  *               studentName:
//  *                 type: string
//  *               major:
//  *                 type: string
//  *               graduationYear:
//  *                 type: number
//  *         issuer_did:
//  *           type: string
//  *           pattern: '^did:dcert:[iu][a-zA-Z0-9_-]{44}$'
//  *           description: DID of the issuer (55 chars total)
//  *           example: "did:dcert:i1a2b3c4d5e6f7890123456789abcdef01234567890123"
//  *         version:
//  *           type: integer
//  *           minimum: 1
//  *           description: Schema version number
//  *           example: 1
//  *         isActive:
//  *           type: boolean
//  *           description: Whether the schema is active
//  *           example: true
//  *         createdAt:
//  *           type: string
//  *           format: date-time
//  *           description: Creation timestamp
//  *         updatedAt:
//  *           type: string
//  *           format: date-time
//  *           description: Last update timestamp
//  */

// // ============================================
// // 🔹 GET ENDPOINTS (Database Only - Fast)
// // ============================================

// /**
//  * @swagger
//  * /schemas:
//  *   get:
//  *     summary: Get all VC schemas
//  *     description: |
//  *       Retrieve all VC schemas from database with optional filters (READ from Database only).
//  *
//  *       **Filters:**
//  *       - Filter by issuer DID (institution only)
//  *       - Show only active schemas
//  *     tags:
//  *       - VC Schema Management
//  *     parameters:
//  *       - in: query
//  *         name: issuerDid
//  *         schema:
//  *           type: string
//  *           pattern: '^did:dcert:[iu][a-zA-Z0-9_-]{44}$'
//  *         description: Filter by issuer DID (format did:dcert:[i/u][44 chars])
//  *         example: "did:dcert:i1a2b3c4d5e6f7890123456789abcdef01234567890123"
//  *       - in: query
//  *         name: activeOnly
//  *         schema:
//  *           type: boolean
//  *         description: Filter to show only active schemas
//  *         example: true
//  *     responses:
//  *       200:
//  *         description: List of VC schemas retrieved successfully
//  *         content:
//  *           application/json:
//  *             schema:
//  *               type: object
//  *               properties:
//  *                 success:
//  *                   type: boolean
//  *                   example: true
//  *                 count:
//  *                   type: integer
//  *                   description: Number of schemas returned
//  *                   example: 5
//  *                 data:
//  *                   type: array
//  *                   items:
//  *                     $ref: '#/components/schemas/VCSchema'
//  *       400:
//  *         description: Invalid query parameters
//  *       500:
//  *         description: Internal server error
//  */
// router.get("/", getAllVCSchemasValidator, vcSchema.getAllVCSchemas);

// /**
//  * @swagger
//  * /schemas/latest:
//  *   get:
//  *     summary: Get latest schema version
//  *     description: |
//  *       Get the latest version of a schema by name and issuer DID (READ from Database only).
//  *
//  *       **Use Case:** Get current active version of a credential schema.
//  *     tags:
//  *       - VC Schema Management
//  *     parameters:
//  *       - in: query
//  *         name: name
//  *         required: true
//  *         schema:
//  *           type: string
//  *           minLength: 3
//  *           maxLength: 255
//  *         description: Schema name (3-255 characters)
//  *         example: "Diploma Certificate"
//  *       - in: query
//  *         name: issuerDid
//  *         required: true
//  *         schema:
//  *           type: string
//  *           pattern: '^did:dcert:[iu][a-zA-Z0-9_-]{44}$'
//  *         description: Issuer DID (format did:dcert:[i/u][44 chars])
//  *         example: "did:dcert:i1a2b3c4d5e6f7890123456789abcdef01234567890123"
//  *     responses:
//  *       200:
//  *         description: Latest schema version retrieved successfully
//  *         content:
//  *           application/json:
//  *             schema:
//  *               type: object
//  *               properties:
//  *                 success:
//  *                   type: boolean
//  *                   example: true
//  *                 data:
//  *                   $ref: '#/components/schemas/VCSchema'
//  *       400:
//  *         description: Missing or invalid parameters
//  *       404:
//  *         description: Schema not found
//  *       500:
//  *         description: Internal server error
//  */
// router.get(
//   "/latest",
//   getLatestSchemaVersionValidator,
//   vcSchema.getLatestSchemaVersion
// );

// /**
//  * @swagger
//  * /schemas/versions:
//  *   get:
//  *     summary: Get all schema versions
//  *     description: |
//  *       Get all versions of a specific schema by name and issuer DID (READ from Database only).
//  *
//  *       **Use Case:** View version history of a credential schema.
//  *     tags:
//  *       - VC Schema Management
//  *     parameters:
//  *       - in: query
//  *         name: name
//  *         required: true
//  *         schema:
//  *           type: string
//  *           minLength: 3
//  *           maxLength: 255
//  *         description: Schema name (3-255 characters)
//  *         example: "Diploma Certificate"
//  *       - in: query
//  *         name: issuerDid
//  *         required: true
//  *         schema:
//  *           type: string
//  *           pattern: '^did:dcert:[iu][a-zA-Z0-9_-]{44}$'
//  *         description: Issuer DID (format did:dcert:[i/u][44 chars])
//  *         example: "did:dcert:i1a2b3c4d5e6f7890123456789abcdef01234567890123"
//  *     responses:
//  *       200:
//  *         description: All schema versions retrieved successfully
//  *         content:
//  *           application/json:
//  *             schema:
//  *               type: object
//  *               properties:
//  *                 success:
//  *                   type: boolean
//  *                   example: true
//  *                 count:
//  *                   type: integer
//  *                   description: Number of versions
//  *                   example: 3
//  *                 data:
//  *                   type: array
//  *                   items:
//  *                     $ref: '#/components/schemas/VCSchema'
//  *       400:
//  *         description: Missing or invalid parameters
//  *       404:
//  *         description: Schema not found
//  *       500:
//  *         description: Internal server error
//  */
// router.get(
//   "/versions",
//   getAllSchemaVersionsValidator,
//   vcSchema.getAllSchemaVersions
// );

// /**
//  * @swagger
//  * /schemas/{id}:
//  *   get:
//  *     summary: Get schema by ID
//  *     description: Retrieve a specific schema by its UUID (READ from Database only)
//  *     tags:
//  *       - VC Schema Management
//  *     parameters:
//  *       - in: path
//  *         name: id
//  *         required: true
//  *         schema:
//  *           type: string
//  *           format: uuid
//  *         description: Schema UUID
//  *         example: "550e8400-e29b-41d4-a716-446655440000"
//  *     responses:
//  *       200:
//  *         description: Schema retrieved successfully
//  *         content:
//  *           application/json:
//  *             schema:
//  *               type: object
//  *               properties:
//  *                 success:
//  *                   type: boolean
//  *                   example: true
//  *                 data:
//  *                   $ref: '#/components/schemas/VCSchema'
//  *       400:
//  *         description: Invalid UUID format
//  *       404:
//  *         description: Schema not found
//  *       500:
//  *         description: Internal server error
//  */
// router.get("/:id", getSchemaByIdValidator, vcSchema.getSchemaById);

// /**
//  * @swagger
//  * /schemas/{id}/active:
//  *   get:
//  *     summary: Check if schema is active
//  *     description: Check the active status of a schema (READ from Database only)
//  *     tags:
//  *       - VC Schema Management
//  *     parameters:
//  *       - in: path
//  *         name: id
//  *         required: true
//  *         schema:
//  *           type: string
//  *           format: uuid
//  *         description: Schema UUID
//  *         example: "550e8400-e29b-41d4-a716-446655440000"
//  *     responses:
//  *       200:
//  *         description: Schema status retrieved successfully
//  *         content:
//  *           application/json:
//  *             schema:
//  *               type: object
//  *               properties:
//  *                 success:
//  *                   type: boolean
//  *                   example: true
//  *                 data:
//  *                   type: object
//  *                   properties:
//  *                     id:
//  *                       type: string
//  *                       format: uuid
//  *                       example: "550e8400-e29b-41d4-a716-446655440000"
//  *                     isActive:
//  *                       type: boolean
//  *                       example: true
//  *       400:
//  *         description: Invalid UUID format
//  *       404:
//  *         description: Schema not found
//  *       500:
//  *         description: Internal server error
//  */
// router.get("/:id/active", isSchemaActiveValidator, vcSchema.isSchemaActive);

// // ============================================
// // 🔹 POST/PUT/PATCH/DELETE ENDPOINTS (Database + Blockchain)
// // ============================================

// /**
//  * @swagger
//  * /schemas:
//  *   post:
//  *     summary: Create new VC schema
//  *     description: |
//  *       Create a new VC schema (version 1) in both Database and Blockchain.
//  *
//  *       **Important:**
//  *       - Schema name must be 3-255 characters
//  *       - Schema must have 'type' property
//  *       - Object schemas must have 'properties'
//  *       - Issuer DID format: did:dcert:[i/u][44 chars]
//  *       - Only institutions (prefix 'i') can create schemas
//  *     tags:
//  *       - VC Schema Management
//  *     requestBody:
//  *       required: true
//  *       content:
//  *         application/json:
//  *           schema:
//  *             type: object
//  *             required:
//  *               - name
//  *               - schema
//  *               - issuer_did
//  *             properties:
//  *               name:
//  *                 type: string
//  *                 minLength: 3
//  *                 maxLength: 255
//  *                 description: Name of the credential schema
//  *                 example: "Diploma Certificate"
//  *               schema:
//  *                 type: object
//  *                 description: JSON schema defining credential structure
//  *                 example:
//  *                   type: object
//  *                   properties:
//  *                     studentName:
//  *                       type: string
//  *                       description: Full name of the student
//  *                     studentId:
//  *                       type: string
//  *                       description: Student ID number
//  *                     major:
//  *                       type: string
//  *                       description: Field of study
//  *                     graduationYear:
//  *                       type: number
//  *                       description: Year of graduation
//  *                     gpa:
//  *                       type: number
//  *                       minimum: 0
//  *                       maximum: 4
//  *                   required: ["studentName", "studentId", "major", "graduationYear"]
//  *               issuer_did:
//  *                 type: string
//  *                 pattern: '^did:dcert:i[a-zA-Z0-9_-]{44}$'
//  *                 description: DID of institution issuer (must start with 'i')
//  *                 example: "did:dcert:i1a2b3c4d5e6f7890123456789abcdef01234567890123"
//  *     responses:
//  *       201:
//  *         description: VC schema created successfully
//  *         content:
//  *           application/json:
//  *             schema:
//  *               type: object
//  *               properties:
//  *                 success:
//  *                   type: boolean
//  *                   example: true
//  *                 message:
//  *                   type: string
//  *                   example: "VC Schema created successfully in database and blockchain"
//  *                 data:
//  *                   $ref: '#/components/schemas/VCSchema'
//  *                 transaction_hash:
//  *                   type: string
//  *                   description: Blockchain transaction hash
//  *                   example: "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
//  *       400:
//  *         description: Validation error or blockchain failure
//  *       409:
//  *         description: Schema already exists
//  *       500:
//  *         description: Internal server error
//  */
// router.post("/", createVCSchemaValidator, vcSchema.createVCSchema);

// /**
//  * @swagger
//  * /schemas/{id}:
//  *   put:
//  *     summary: Update existing VC schema
//  *     description: |
//  *       Update an existing VC schema (creates new version) in both Database and Blockchain.
//  *
//  *       **Version Control:**
//  *       - Each update creates a new version
//  *       - Previous versions remain accessible
//  *       - Version number auto-increments
//  *     tags:
//  *       - VC Schema Management
//  *     parameters:
//  *       - in: path
//  *         name: id
//  *         required: true
//  *         schema:
//  *           type: string
//  *           format: uuid
//  *         description: UUID of the schema to update
//  *         example: "550e8400-e29b-41d4-a716-446655440000"
//  *     requestBody:
//  *       required: true
//  *       content:
//  *         application/json:
//  *           schema:
//  *             type: object
//  *             required:
//  *               - schema
//  *             properties:
//  *               schema:
//  *                 type: object
//  *                 description: Updated JSON schema structure (creates new version)
//  *                 example:
//  *                   type: object
//  *                   properties:
//  *                     studentName:
//  *                       type: string
//  *                     studentId:
//  *                       type: string
//  *                     major:
//  *                       type: string
//  *                     graduationYear:
//  *                       type: number
//  *                     gpa:
//  *                       type: number
//  *                     honors:
//  *                       type: string
//  *                       enum: ["Cum Laude", "Magna Cum Laude", "Summa Cum Laude"]
//  *                   required: ["studentName", "studentId", "major", "graduationYear"]
//  *     responses:
//  *       200:
//  *         description: VC schema updated successfully (new version created)
//  *         content:
//  *           application/json:
//  *             schema:
//  *               type: object
//  *               properties:
//  *                 success:
//  *                   type: boolean
//  *                   example: true
//  *                 message:
//  *                   type: string
//  *                   example: "VC Schema updated successfully in database and blockchain"
//  *                 data:
//  *                   allOf:
//  *                     - $ref: '#/components/schemas/VCSchema'
//  *                     - type: object
//  *                       properties:
//  *                         version:
//  *                           type: integer
//  *                           description: New version number
//  *                           example: 2
//  *                 transaction_hash:
//  *                   type: string
//  *       400:
//  *         description: Validation error or blockchain failure
//  *       404:
//  *         description: Schema not found
//  *       500:
//  *         description: Internal server error
//  */
// router.put("/:id", updateVCSchemaValidator, vcSchema.updateVCSchema);

// /**
//  * @swagger
//  * /schemas/{id}/deactivate:
//  *   patch:
//  *     summary: Deactivate VC schema
//  *     description: |
//  *       Deactivate a VC schema in both Database and Blockchain.
//  *
//  *       **Effect:**
//  *       - Schema cannot be used for new credentials
//  *       - Existing credentials remain valid
//  *     tags:
//  *       - VC Schema Management
//  *     parameters:
//  *       - in: path
//  *         name: id
//  *         required: true
//  *         schema:
//  *           type: string
//  *           format: uuid
//  *         description: UUID of the schema to deactivate
//  *         example: "550e8400-e29b-41d4-a716-446655440000"
//  *     responses:
//  *       200:
//  *         description: Schema deactivated successfully
//  *         content:
//  *           application/json:
//  *             schema:
//  *               type: object
//  *               properties:
//  *                 success:
//  *                   type: boolean
//  *                   example: true
//  *                 message:
//  *                   type: string
//  *                   example: "VC Schema deactivated successfully"
//  *                 data:
//  *                   allOf:
//  *                     - $ref: '#/components/schemas/VCSchema'
//  *                     - type: object
//  *                       properties:
//  *                         isActive:
//  *                           type: boolean
//  *                           example: false
//  *                 transaction_hash:
//  *                   type: string
//  *       400:
//  *         description: Schema already deactivated or blockchain failure
//  *       404:
//  *         description: Schema not found
//  *       500:
//  *         description: Internal server error
//  */
// router.patch(
//   "/:id/deactivate",
//   deactivateVCSchemaValidator,
//   vcSchema.deactivateVCSchema
// );

// /**
//  * @swagger
//  * /schemas/{id}/reactivate:
//  *   patch:
//  *     summary: Reactivate VC schema
//  *     description: Reactivate a deactivated VC schema in both Database and Blockchain
//  *     tags:
//  *       - VC Schema Management
//  *     parameters:
//  *       - in: path
//  *         name: id
//  *         required: true
//  *         schema:
//  *           type: string
//  *           format: uuid
//  *         description: UUID of the schema to reactivate
//  *         example: "550e8400-e29b-41d4-a716-446655440000"
//  *     responses:
//  *       200:
//  *         description: Schema reactivated successfully
//  *         content:
//  *           application/json:
//  *             schema:
//  *               type: object
//  *               properties:
//  *                 success:
//  *                   type: boolean
//  *                   example: true
//  *                 message:
//  *                   type: string
//  *                   example: "VC Schema reactivated successfully"
//  *                 data:
//  *                   allOf:
//  *                     - $ref: '#/components/schemas/VCSchema'
//  *                     - type: object
//  *                       properties:
//  *                         isActive:
//  *                           type: boolean
//  *                           example: true
//  *                 transaction_hash:
//  *                   type: string
//  *       400:
//  *         description: Schema already active or blockchain failure
//  *       404:
//  *         description: Schema not found
//  *       500:
//  *         description: Internal server error
//  */
// router.patch(
//   "/:id/reactivate",
//   reactivateVCSchemaValidator,
//   vcSchema.reactivateVCSchema
// );

// export default router;
