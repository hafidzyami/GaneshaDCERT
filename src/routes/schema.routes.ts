import express, { Router } from "express";
import * as vcSchema from "../controllers/schema.controller";
import {
  getAllVCSchemasValidator,
  createVCSchemaValidator,
  updateVCSchemaValidator,
} from "../validators/schema.validator";

const router: Router = express.Router();

/**
 * @swagger
 * tags:
 *   name: VC Schema Management
 *   description: Verifiable Credential schema management endpoints (Database + Blockchain)
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
 *           description: DID of the issuer
 *           example: "did:example:university123"
 *         version:
 *           type: integer
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

/**
 * @swagger
 * /schemas:
 *   get:
 *     summary: Get all VC schemas
 *     description: Retrieve all VC schemas from database with optional filters (READ from Database only)
 *     tags:
 *       - VC Schema Management
 *     parameters:
 *       - in: query
 *         name: issuerDid
 *         schema:
 *           type: string
 *         description: Filter schemas by issuer DID
 *         example: "did:example:university123"
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
 *       500:
 *         description: Internal server error
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
 *                   example: "Failed to fetch VC schemas"
 */
router.get("/", getAllVCSchemasValidator, vcSchema.getAllVCSchemas);

/**
 * @swagger
 * /schemas/{id}:
 *   get:
 *     summary: Get schema by ID
 *     description: Retrieve a specific schema by its UUID (READ from Database only)
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
 *       404:
 *         description: Schema not found
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
 *                   example: "Schema with ID 550e8400-e29b-41d4-a716-446655440000 not found"
 *       500:
 *         description: Internal server error
 */
router.get("/:id", vcSchema.getSchemaById);

/**
 * @swagger
 * /schemas/latest:
 *   get:
 *     summary: Get latest schema version
 *     description: Get the latest version of a schema by name and issuer DID (READ from Database only)
 *     tags:
 *       - VC Schema Management
 *     parameters:
 *       - in: query
 *         name: name
 *         required: true
 *         schema:
 *           type: string
 *         description: Schema name
 *         example: "Diploma Certificate"
 *       - in: query
 *         name: issuerDid
 *         required: true
 *         schema:
 *           type: string
 *         description: Issuer DID
 *         example: "did:example:university123"
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
 *         description: Missing required parameters
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
 *                   example: "Name and issuerDid are required"
 *       404:
 *         description: Schema not found
 *       500:
 *         description: Internal server error
 */
router.get("/latest", vcSchema.getLatestSchemaVersion);

/**
 * @swagger
 * /schemas/versions:
 *   get:
 *     summary: Get all schema versions
 *     description: Get all versions of a specific schema by name and issuer DID (READ from Database only)
 *     tags:
 *       - VC Schema Management
 *     parameters:
 *       - in: query
 *         name: name
 *         required: true
 *         schema:
 *           type: string
 *         description: Schema name
 *         example: "Diploma Certificate"
 *       - in: query
 *         name: issuerDid
 *         required: true
 *         schema:
 *           type: string
 *         description: Issuer DID
 *         example: "did:example:university123"
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
 *         description: Missing required parameters
 *       404:
 *         description: Schema not found
 *       500:
 *         description: Internal server error
 */
router.get("/versions", vcSchema.getAllSchemaVersions);

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
 *       404:
 *         description: Schema not found
 *       500:
 *         description: Internal server error
 */
router.get("/:id/active", vcSchema.isSchemaActive);

/**
 * @swagger
 * /schemas:
 *   post:
 *     summary: Create new VC schema
 *     description: Create a new VC schema (version 1) in both Database and Blockchain
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
 *                 description: DID of the issuer creating this schema
 *                 example: "did:example:university123"
 *     responses:
 *       201:
 *         description: VC schema created successfully in database and blockchain
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
 *                   description: Blockchain transaction hash
 *                   example: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
 *       400:
 *         description: Invalid schema structure, validation error, or blockchain failure
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
 *                   example: "Blockchain creation failed: gas too low"
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
 *     description: Update an existing VC schema (creates new version) in both Database and Blockchain
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
 *                   description: Blockchain transaction hash
 *                   example: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"
 *       400:
 *         description: Invalid update data, validation error, or blockchain failure
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
 *                   example: "Blockchain update failed: transaction reverted"
 *       404:
 *         description: Schema not found
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
 *                   example: "Schema with ID 550e8400-e29b-41d4-a716-446655440000 not found"
 *       500:
 *         description: Internal server error
 */
router.put("/:id", updateVCSchemaValidator, vcSchema.updateVCSchema);

/**
 * @swagger
 * /schemas/{id}/deactivate:
 *   patch:
 *     summary: Deactivate VC schema
 *     description: Deactivate a VC schema in both Database and Blockchain
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
 *                   example: "0x9876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba"
 *       400:
 *         description: Schema is already deactivated or blockchain failure
 *       404:
 *         description: Schema not found
 *       500:
 *         description: Internal server error
 */
router.patch("/:id/deactivate", vcSchema.deactivateVCSchema);

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
 *                   example: "0xfedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210"
 *       400:
 *         description: Schema is already active or blockchain failure
 *       404:
 *         description: Schema not found
 *       500:
 *         description: Internal server error
 */
router.patch("/:id/reactivate", vcSchema.reactivateVCSchema);

/**
 * @swagger
 * /schemas/{id}:
 *   delete:
 *     summary: Delete VC schema
 *     description: Soft delete (deactivate) a VC schema in both Database and Blockchain
 *     tags:
 *       - VC Schema Management
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID of the schema to delete
 *         example: "550e8400-e29b-41d4-a716-446655440000"
 *     responses:
 *       200:
 *         description: Schema deleted (deactivated) successfully
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
 *                   example: "VC Schema deleted (deactivated) successfully"
 *                 transaction_hash:
 *                   type: string
 *                   example: "0x1357924680fedcba1357924680fedcba1357924680fedcba1357924680fedcba"
 *       404:
 *         description: Schema not found
 *       500:
 *         description: Internal server error
 */
router.delete("/:id", vcSchema.deleteVCSchema);

export default router;
