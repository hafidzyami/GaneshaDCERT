import express, { Router } from "express";
import * as credentialController from "../controllers/credential.controller";
import {
  requestCredentialValidator,
  getCredentialRequestsByTypeValidator,
  processCredentialResponseValidator,
  getHolderVCsValidator,
  credentialUpdateRequestValidator,
  credentialRenewalRequestValidator,
  credentialRevocationRequestValidator,
  addVCStatusBlockValidator,
  getVCStatusValidator,
} from "../validators/credential.validator";

const router: Router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Verifiable Credential (VC) Lifecycle
 *   description: VC issuance, renewal, update, revocation, and status management
 */

// Request credential issuance
router.post("/requests", requestCredentialValidator, credentialController.requestCredential);

// Get credential requests by type
router.get("/get-requests", getCredentialRequestsByTypeValidator, credentialController.getCredentialRequestsByType);

// Process credential response (issue/renew/update)
router.post("/response", processCredentialResponseValidator, credentialController.processCredentialResponse);

// Get holder's VCs
router.get("/credentials", getHolderVCsValidator, credentialController.getHolderVCs);

// Request credential update
router.post("/update-request", credentialUpdateRequestValidator, credentialController.requestCredentialUpdate);

// Request credential renewal
router.post("/renew-requests", credentialRenewalRequestValidator, credentialController.requestCredentialRenewal);

// Request credential revocation
router.post("/revoke-request", credentialRevocationRequestValidator, credentialController.requestCredentialRevocation);

// Add VC status block to blockchain
router.post("/add-status-block", addVCStatusBlockValidator, credentialController.addVCStatusBlock);

// Get VC status
router.get("/:vcId/status", getVCStatusValidator, credentialController.getVCStatus);

export default router;
