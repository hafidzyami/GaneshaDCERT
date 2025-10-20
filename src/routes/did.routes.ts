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
 *   name: DID & Account Management
 *   description: DID registration, key rotation, and account management
 */

// Register new DID
router.post("/", registerDIDValidator, did.registerDID);

// Check if DID exists
router.get("/check/:did", checkDIDValidator, did.checkDID);

// Get blockchain block count
router.get("/blocks", did.numberofBlocks);

// Rotate DID key
router.put("/:did/key-rotation", keyRotationValidator, did.keyRotation);

// Deactivate DID
router.delete("/:did", deleteDIDValidator, did.deleteDID);

// Get DID Document
router.get("/:did/document", getDIDDocumentValidator, did.getDIDDocument);

export default router;
