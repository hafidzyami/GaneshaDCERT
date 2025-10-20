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
 *   description: Verifiable Credential schema management endpoints
 */

/**
 * @swagger
 * /schemas:
 *   get:
 *     summary: Get all VC schemas
 *     description: Retrieve all available VC schemas with optional issuer filter
 *     tags:
 *       - VC Schema Management
 *     parameters:
 *       - in: query
 *         name: issuer_did
 *         schema:
 *           type: string
 *         description: Filter schemas by issuer DID
 *       - in: query
 *         name: is_active
 *         schema:
 *           type: boolean
 *         description: Filter by active status
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Filter by schema category (e.g., education, employment, identity)
 *     responses:
 *       200:
 *         description: List of VC schemas
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       schema_id:
 *                         type: string
 *                         format: uuid
 *                       schema_name:
 *                         type: string
 *                         example: University Degree Certificate
 *                       schema_version:
 *                         type: string
 *                         example: "1.0"
 *                       issuer_did:
 *                         type: string
 *                       category:
 *                         type: string
 *                         example: education
 *                       description:
 *                         type: string
 *                       schema_fields:
 *                         type: object
 *                         description: JSON schema defining credential structure
 *                       is_active:
 *                         type: boolean
 *                       created_at:
 *                         type: string
 *                         format: date-time
 *                       updated_at:
 *                         type: string
 *                         format: date-time
 *       400:
 *         description: Invalid query parameters
 *       500:
 *         description: Internal server error
 */
router.get("/", getAllVCSchemasValidator, vcSchema.getAllVCSchemas);

/**
 * @swagger
 * /schemas:
 *   post:
 *     summary: Create new VC schema
 *     description: Create a new Verifiable Credential schema template
 *     tags:
 *       - VC Schema Management
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - schema_name
 *               - issuer_did
 *               - schema_fields
 *             properties:
 *               schema_name:
 *                 type: string
 *                 example: University Degree Certificate
 *                 description: Name of the credential schema
 *               schema_version:
 *                 type: string
 *                 example: "1.0"
 *                 default: "1.0"
 *                 description: Version of the schema
 *               issuer_did:
 *                 type: string
 *                 example: did:ganesha:0xissuer123
 *                 description: DID of the issuer creating this schema
 *               category:
 *                 type: string
 *                 example: education
 *                 description: Category of the credential (education, employment, identity, etc.)
 *               description:
 *                 type: string
 *                 example: Official university degree certificate for graduates
 *                 description: Description of what this credential represents
 *               schema_fields:
 *                 type: object
 *                 description: JSON schema defining the structure and validation rules for credentials
 *                 example:
 *                   type: object
 *                   properties:
 *                     studentName:
 *                       type: string
 *                       description: Full name of the student
 *                     studentId:
 *                       type: string
 *                       description: Student ID number
 *                     degree:
 *                       type: string
 *                       enum: ["Bachelor", "Master", "Doctorate"]
 *                     major:
 *                       type: string
 *                     graduationDate:
 *                       type: string
 *                       format: date
 *                     gpa:
 *                       type: number
 *                       minimum: 0
 *                       maximum: 4
 *                   required: ["studentName", "studentId", "degree", "major", "graduationDate"]
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
 *                   example: VC schema berhasil dibuat
 *                 data:
 *                   type: object
 *                   properties:
 *                     schema_id:
 *                       type: string
 *                       format: uuid
 *                     schema_name:
 *                       type: string
 *                     schema_version:
 *                       type: string
 *                     issuer_did:
 *                       type: string
 *       400:
 *         description: Invalid schema structure or validation error
 *       404:
 *         description: Issuer DID not found
 *       409:
 *         description: Schema with same name and version already exists
 *       500:
 *         description: Internal server error
 */
router.post("/", createVCSchemaValidator, vcSchema.createVCSchema);

/**
 * @swagger
 * /schemas/{schemaId}:
 *   put:
 *     summary: Update existing VC schema
 *     description: Update an existing VC schema (creates new version or updates current)
 *     tags:
 *       - VC Schema Management
 *     parameters:
 *       - in: path
 *         name: schemaId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID of the schema to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               schema_name:
 *                 type: string
 *                 description: Updated name of the schema
 *               schema_version:
 *                 type: string
 *                 description: New version number (if creating new version)
 *               category:
 *                 type: string
 *                 description: Updated category
 *               description:
 *                 type: string
 *                 description: Updated description
 *               schema_fields:
 *                 type: object
 *                 description: Updated JSON schema structure
 *               is_active:
 *                 type: boolean
 *                 description: Set schema active/inactive status
 *     responses:
 *       200:
 *         description: VC schema updated successfully
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
 *                   example: VC schema berhasil diupdate
 *                 data:
 *                   type: object
 *                   properties:
 *                     schema_id:
 *                       type: string
 *                       format: uuid
 *                     schema_name:
 *                       type: string
 *                     schema_version:
 *                       type: string
 *                     updated_at:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Invalid update data or validation error
 *       404:
 *         description: Schema not found
 *       403:
 *         description: Unauthorized to update this schema
 *       500:
 *         description: Internal server error
 */
router.put("/:schemaId", updateVCSchemaValidator, vcSchema.updateVCSchema);

export default router;
