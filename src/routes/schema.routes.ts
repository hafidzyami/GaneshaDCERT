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

// Get all VC schemas with optional issuer filter
router.get("/", getAllVCSchemasValidator, vcSchema.getAllVCSchemas);

// Create new VC schema
router.post("/", createVCSchemaValidator, vcSchema.createVCSchema);

// Update existing VC schema
router.put("/:schemaId", updateVCSchemaValidator, vcSchema.updateVCSchema);

export default router;
