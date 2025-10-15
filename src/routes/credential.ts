// In src/routes/credential.ts

import express, { Router } from "express";
import { body, query } from "express-validator";

import * as credentialController from "../controllers/credential";

const router: Router = express.Router();

/**
 * @swagger
 * /credential/requests:
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
  "/requests",
  [
    // Updated validation rules for the new request body
    body("encrypted_body", "encrypted_body must not be empty!").trim().not().isEmpty(),
    body("issuer_did", "issuer_did must not be empty!").trim().not().isEmpty(),
    body("holder_did", "holder_did must not be empty!").trim().not().isEmpty(),
  ],
  credentialController.requestCredential
);

/**
 * @swagger
 * /credential/get-requests:
 *  get:
 *      summary: Get all VC requests by type
 *      description: Retrieve all Verifiable Credential lifecycle requests, filtered by a specific type and optionally by the issuer's DID.
 *      tags:
 *          - Verifiable Credential (VC) Lifecycle
 *      parameters:
 *          - in: query
 *            name: type
 *            required: true
 *            schema:
 *              type: string
 *              enum: [ISSUANCE, RENEWAL, UPDATE, REVOKE]
 *              description: The type of credential request to retrieve.
 *          - in: query
 *            name: issuer_did
 *            required: false
 *            schema:
 *              type: string
 *              description: The DID of the issuer to filter requests by.
 *      responses:
 *          200:
 *            description: A list of credential requests.
 *            # ... same response schema as before ...
 *          400:
 *            description: Validation error (e.g., invalid type).
 */
router.get(
  "/get-requests",
  [
    query("type", "A valid request type must be provided")
      .isIn(["ISSUANCE", "RENEWAL", "UPDATE", "REVOKE"])
      .trim(),
    query("issuer_did").optional().isString().trim(), // Add validation for optional issuer_did
  ],
  credentialController.getCredentialRequestsByType
);

/**
 * @swagger
 * /credential/issue:
 *  post:
 *      summary: Issue a Verifiable Credential
 *      description: An issuer sends an encrypted and issued VC to a holder, finalizing the issuance process.
 *      tags:
 *          - Verifiable Credential (VC) Lifecycle
 *      requestBody:
 *          required: true
 *          content:
 *              application/json:
 *                  schema:
 *                    type: object
 *                    properties:
 *                        request_id:
 *                            type: string
 *                            format: uuid
 *                            description: The ID of the original credential request.
 *                        issuer_did:
 *                            type: string
 *                        holder_did:
 *                            type: string
 *                        encrypted_body:
 *                            type: string
 *                            description: The encrypted issued VC payload.
 *      responses:
  *        "201":
 *              description: Request successfully created.
 *              content:
 *                  application/json:
 *                      schema:
 *                          type: object
 *                          properties:
 *                              message:
 *                                  type: string
 *                              vc_response_id:
 *                                  type: string
 *                                  format: uuid
 */
router.post(
  "/issue",
  [
    body("request_id", "request_id must not be empty!").trim().not().isEmpty(),
    body("issuer_did", "issuer_did must not be empty!").trim().not().isEmpty(),
    body("holder_did", "holder_did must not be empty!").trim().not().isEmpty(),
    body("encrypted_body", "encrypted_body must not be empty!").trim().not().isEmpty(),
  ],
  credentialController.issueCredential
);


export default router;