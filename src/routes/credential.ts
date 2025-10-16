// In src/routes/credential.ts

import express, { Router } from "express";
import { body, query, param } from "express-validator";

import * as credentialController from "../controllers/credential";

const router: Router = express.Router();

/**
 * @swagger
 * /credentials/requests:
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
 * /credentials/get-requests:
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
 * /credentials/issue:
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
 *                        request_type:
 *                            type: string
 *                            enum: [ISSUANCE, RENEWAL, UPDATE]
 *                            description: The type of response being submitted.
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
  "/credentials/response", // A more generic and accurate URL
  [
    body("request_id").not().isEmpty(),
    body("issuer_did").not().isEmpty(),
    body("holder_did").not().isEmpty(),
    body("encrypted_body").not().isEmpty(),
    // Add validation for the new request_type field
    body("request_type")
      .isIn(["ISSUANCE", "RENEWAL", "UPDATE"])
      .withMessage("request_type must be one of ISSUANCE, RENEWAL, or UPDATE"),
  ],
  // Point to the new controller function
  credentialController.processCredentialResponse 
);

/**
 * @swagger
 * /credentials/credentials:
 *  get:
 *    summary: Get a list of VCs for a specific holder
 *    description: Retrieves a list of all Verifiable Credentials associated with a specific holder DID.
 *    tags:
 *      - Verifiable Credential (VC) Lifecycle
 *    parameters:
 *      - in: query
 *        name: holderDid
 *        required: true
 *        schema:
 *            type: string
 *            description: The DID of the holder whose VCs are to be retrieved.
 *            example: "did:example:a58a9d8fa9w5d"
 *    responses:
 *      200:
 *        description: A list of VCs for the specified holder.
 *        content:
 *          application/json:
 *              schema:
 *                type: object
 *                properties:
 *                    message:
 *                        type: string
 *                    count:
 *                        type: integer
 *                    data:
 *                        type: array
 *                        items:
 *                          type: object
 *                          properties:
 *                            vc_id:
 *                              type: string
 *                            schema_id:
 *                              type: string
 *                            issuer_did:
 *                              type: string
 *                            hash:
 *                              type: string
 *                            status:
 *                              type: boolean
 *      400:
 *        description: Validation error (e.g., holderDid not provided).
 */
router.get(
  "/credentials",
  [
    query("holderDid", "holderDid must be provided in the query")
      .trim()
      .not()
      .isEmpty(),
  ],
  credentialController.getHolderVCs
);

/**
 * @swagger
 * /credentials/update-request:
 *  post:
 *    summary: Request the update of an existing VC
 *    description: A holder sends an encrypted request to an issuer to update an existing Verifiable Credential.
 *    tags:
 *      - Verifiable Credential (VC) Lifecycle
 *    requestBody:
 *          required: true
 *          content:
 *              application/json:
 *                  schema:
 *                      type: object
 *                      required:
 *                          - issuer_did
 *                          - holder_did
 *                          - encrypted_body
 *                      properties:
 *                          issuer_did:
 *                              type: string
 *                          holder_did:
 *                              type: string
 *                          encrypted_body:
 *                              type: string
 *                              description: The encrypted payload containing the VC with the changed values.
 *    responses:
 *      "201":
 *        description: Update request submitted successfully.
 *        content:
 *            application/json:
 *                schema:
 *                    type: object
 *                    properties:
 *                        message:
 *                            type: string
 *                        request_id:
 *                            type: string
 *                            format: uuid
 *      "400":
 *          description: Validation error.          
 */
router.post(
    "/update-request",
    [
        body("issuer_did", "issuer_did must not be empty!").trim().not().isEmpty(),
        body("holder_did", "holder_did must not be empty!").trim().not().isEmpty(),
        // I've used encrypted_body to be consistent with your other models and migrations
        body("encrypted_body", "encrypted_body must not be empty!").trim().not().isEmpty(),
    ],
    credentialController.requestCredentialUpdate
);

/**
 * @swagger
 * /credentials/renew-requests:
 *  post:
 *      summary: Request the renewal of an existing VC
 *      description: A holder sends an encrypted request to an issuer to renew an existing Verifiable Credential.
 *      tags:
 *        - Verifiable Credential (VC) Lifecycle
 *      requestBody:
 *            required: true
 *            content:
 *                application/json:
 *                    schema:
 *                        type: object
 *                        required:
 *                            - issuer_did
 *                            - holder_did
 *                            - encrypted_body
 *                        properties:
 *                            issuer_did:
 *                                type: string
 *                            holder_did:
 *                                type: string
 *                            encrypted_body:
 *                                type: string
 *                                description: The encrypted payload containing the VC with the changed values.
 *      responses:
 *        "201":
 *          description: Update request submitted successfully.
 *          content:
 *              application/json:
 *                  schema:
 *                      type: object
 *                      properties:
 *                          message:
 *                              type: string
 *                          request_id:
 *                              type: string
 *                              format: uuid
 *        "400":
 *            description: Validation error. 
 */
router.post(
    "/renew-requests",
    [
        body("issuer_did", "issuer_did must not be empty!").trim().not().isEmpty(),
        body("holder_did", "holder_did must not be empty!").trim().not().isEmpty(),
        body("encrypted_body", "encrypted_body must not be empty!").trim().not().isEmpty(),
    ],
    credentialController.requestCredentialRenewal
);

/**
 * @swagger
 * /credentials/revoke-request:
 *  post:
 *      summary: Request the revocation of an existing VC
 *      description: A holder sends an encrypted request to an issuer to revoke an existing Verifiable Credential.
 *      tags:
 *        - Verifiable Credential (VC) Lifecycle
 *      requestBody:
 *            required: true
 *            content:
 *                application/json:
 *                    schema:
 *                        type: object
 *                        required:
 *                            - issuer_did
 *                            - holder_did
 *                            - encrypted_body
 *                        properties:
 *                            issuer_did:
 *                                type: string
 *                            holder_did:
 *                                type: string
 *                            encrypted_body:
 *                                type: string
 *                                description: The encrypted payload containing the ID of the VC to be revoked and optionally a reason.
 *      responses:
 *        "201":
 *          description: Revocation request submitted successfully.
 *          content:
 *              application/json:
 *                  schema:
 *                      type: object
 *                      properties:
 *                          message:
 *                              type: string
 *                          request_id:
 *                              type: string
 *                              format: uuid
 *        "400":
 *            description: Validation error. 
 */
router.post(
    "/revoke-request",
    [
        body("issuer_did", "issuer_did must not be empty!").trim().not().isEmpty(),
        body("holder_did", "holder_did must not be empty!").trim().not().isEmpty(),
        body("encrypted_body", "encrypted_body must not be empty!").trim().not().isEmpty(),
    ],
    credentialController.requestCredentialRevocation
);

/**
 * @swagger
 * /credentials/add-status-block:
 *  post:
 *      summary: Insert a new VC status block to the blockchain
 *      description: Submits a transaction to the blockchain to create a new block for tracking VC status (e.g., active, revoked).
 *      tags:
 *        - Verifiable Credential (VC) Lifecycle
 *      requestBody:
 *            required: true
 *            content:
 *                application/json:
 *                    schema:
 *                        type: object
 *                        required:
 *                            required:
 *                                - vc_id
 *                                - issuer_did
 *                                - holder_did
 *                                - status
 *                                - hash
 *                        properties:
 *                            vc_id:
 *                                type: string
 *                            issuer_did:
 *                                type: string
 *                            holder_did:
 *                                type: string
 *                            hash:
 *                                type: string
 *                                description: The hash of the VC data.
 *                            status:
 *                                type: string
 *                                description: The current status of the VC (e.g., true for active, false for revoked).
 *      responses:
 *        "201":
 *          description: The transaction for the new status block has been submitted
 *          content:
 *              application/json:
 *                  schema:
 *                      type: object
 *                      properties:
 *                          message:
 *                              type: string
 *                          request_id:
 *                              type: string
 *                              format: uuid
 *        "400":
 *            description: Validation error. 
 */
router.post(
    "/add-status-block",
    [
        body("vc_id", "vc_id must not be empty!").trim().not().isEmpty(),
        body("issuer_did", "issuer_did must not be empty!").trim().not().isEmpty(),
        body("holder_did", "holder_did must not be empty!").trim().not().isEmpty(),
        body("status", "status must be a boolean value!").isBoolean(),
        body("hash", "hash must not be empty!").trim().not().isEmpty(),
    ],
    credentialController.addVCStatusBlock
);

/**
 * @swagger
 * /credentials/{vcId}/status:
 *  get:
 *    summary: Check the status of a specific VC
 *    description: Performs a publicly verifiable status check of a Verifiable Credential on the blockchain.
 *    tags:
 *      - Verifiable Credential (VC) Lifecycle
 *    parameters:
 *        - in: path
 *          name: vcId
 *          required: true
 *          schema:
 *              type: string
 *              description: The unique identifier of the VC to check.
 *        - in: query
 *          name: issuerDid
 *          required: true
 *          schema:
 *              type: string
 *              description: The DID of the issuer for verification.
 *        - in: query
 *          name: holderDid
 *          required: true
 *          schema:
 *              type: string
 *              description: The DID of the holder for verification.
 *    responses:
 *      "200":
 *        description: The current status of the VC.
 *        content:
 *            application/json:
 *                schema:
 *                    type: object
 *                    properties:
 *                        status:
 *                            type: string
 *                            example: "active"
 *                        revoked:
 *                            type: boolean
 *                            example: false
 *        "400":
 *          description: Validation error.
 */
router.get(
    "/:vcId/status",
    [
        param("vcId", "vcId in path must not be empty!").trim().not().isEmpty(),
        query("issuerDid", "issuerDid in query must not be empty!").trim().not().isEmpty(),
        query("holderDid", "holderDid in query must not be empty!").trim().not().isEmpty(),
    ],
    credentialController.getVCStatus
);
export default router;