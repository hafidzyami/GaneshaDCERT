// In src/routes/credential.ts

import express, { Router } from "express";
import { body } from "express-validator";

import * as credentialController from "../controllers/credential";

const router: Router = express.Router();

/**
 * @swagger
 * /credential-requests:
 *  post:
 *      summary: Request a Verifiable Credential
 *      description: A holder sends an encrypted request for a VC to an issuer.
 *      tags:
 *          - Verifiable Credential (VC) Lifecycle
 *      requestBody:
 *          required: true
 *          content:
 *              application/json:
 *                  schema:
 *                      type: object
 *                      properties:
 *                          encrypted_body:
 *                              type: string
 *                              description: The encrypted request payload.
 *                          issuer_did:
 *                              type: string
 *                          holder_did:
 *                              type: string
 *                  example:
 *                      encrypted_body: "eyJhbGciOiJSU0EtT0FFUC0yNTYiLCJlbmMiOiJBMjU2R0NNIn0..."
 *                      issuer_did: "did:example:b34ca6cd37bbf23"
 *                      holder_did: "did:example:a58a9d8fa9w5d"
 *      responses:
 *          "201":
 *              description: Request successfully created.
 *              content:
 *                  application/json:
 *                      schema:
 *                          type: object
 *                          properties:
 *                              message:
 *                                  type: string
 *                              request_id:
 *                                  type: string
 *                                  format: uuid
 */
router.post(
  "/credential-requests",
  [
    // Updated validation rules for the new request body
    body("encrypted_body", "encrypted_body must not be empty!").trim().not().isEmpty(),
    body("issuer_did", "issuer_did must not be empty!").trim().not().isEmpty(),
    body("holder_did", "holder_did must not be empty!").trim().not().isEmpty(),
  ],
  credentialController.requestCredential
);

export default router;