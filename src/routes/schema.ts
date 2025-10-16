import express, { Router } from "express";
import { body, param, query } from "express-validator";

import * as vcSchema from "../controllers/schema";

const router: Router = express.Router();

/**
 * @swagger
 * /schemas:
 *  get:
 *      summary: Get all VC schemas
 *      description: Get all VC schemas, with an optional filter by issuer DID.
 *      tags:
 *          - "VC Schema Management"
 *      parameters:
 *          - in: query
 *            name: issuerDid
 *            schema:
 *              type: string
 *              description: The DID of the issuer to filter schemas by.
 *              example: "did:example:123456"
 *      responses:
 *          200:
 *              description: A list of VC schemas.
 *              content:
 *                  application/json:
 *                      schema:
 *                          type: array
 *                          items:
 *                              type: object
 *                              properties:
 *                                  id:
 *                                      type: string
 *                                  name:
 *                                      type: string
 *                                  schema:
 *                                      type: object
 *                                  issuer_did:
 *                                      type: string
 *                                  version:
 *                                      type: integer
 */
router.get(
  "/",
  [query("issuerDid").optional().isString()],
  vcSchema.getAllVCSchemas
);

/**
 * @swagger
 * /schemas:
 *  post:
 *      summary: Register a new VC schema
 *      description: Register a new VC schema. This action should be stored on the blockchain.
 *      tags:
 *          - "VC Schema Management"
 *      requestBody:
 *          required: true
 *          content:
 *              application/json:
 *                  schema:
 *                      type: object
 *                      required:
 *                          - id
 *                          - name
 *                          - schema
 *                          - issuer_did
 *                      properties:
 *                          id:
 *                              type: string
 *                              example: "sch:hid:12345"
 *                          name:
 *                              type: string
 *                              example: "Proof of Enrollment"
 *                          schema:
 *                              type: object
 *                              example:
 *                                  properties:
 *                                      major: "Bachelor's Degree"
 *                                      issuer_did: "did:example:issuer123"
 *                                      version: 1
 *      responses:
 *          201:
 *              description: VC Schema registered successfully.
 *              content:
 *                  application/json:
 *              schema:
 *                  type: object
 *                  properties:
 *                      message:
 *                          type: string
 *                      schema_id:
 *                          type: string
 */
router.post(
  "/",
  [
    body("id", "Schema ID is required").trim().not().isEmpty(),
    body("name", "Schema name is required").trim().not().isEmpty(),
    body("schema", "Schema definition is required").isObject(),
    body("issuer_did", "Issuer DID is required").trim().not().isEmpty(),
    body("version").optional().isInt({ min: 1 }),
  ],
  vcSchema.createVCSchema
);

/**
 * @swagger
 * /schemas/{schemaId}:
 *  put:
 *      summary: Update an existing VC schema
 *      description: Update an existing VC schema. The version number must be incremented.
 *      tags:
 *          - "VC Schema Management"
 *      parameters:
 *          - in: path
 *            name: schemaId
 *            required: true
 *            schema:
 *              type: string
 *              description: The ID of the schema to update.
 *      requestBody:
 *          required: true
 *          content:
 *              application/json:
 *                  schema:
 *                      type: object
 *                      required:
 *                          - version
 *                      properties:
 *                          name:
 *                              type: string
 *                          schema:
 *                              type: object
 *                          issuer_did:
 *                              type: string
 *                          version:
 *                              type: integer
 *                              description: The new version number, must be greater than the current one.
 *      responses:
 *          200:
 *              description: VC schema updated successfully.
 *          400:
 *              description: Validation error (e.g., version not incremented).
 *          404:
 *              description: Schema not found.
 */
router.put(
  "/:schemaId",
  [
    param("schemaId", "Schema ID is required").trim().not().isEmpty(),
    body("name").optional().trim().not().isEmpty(),
    body("schema").optional().isObject(),
    body("issuer_did").optional().trim().not().isEmpty(),
    body("version", "Version is required and must be an integer").isInt({
      min: 1,
    }),
  ],
  vcSchema.updateVCSchema
);

export default router;
