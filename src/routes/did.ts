import express, { Router } from "express";
import { body, param } from "express-validator";

import * as did from "../controllers/did";

const router: Router = express.Router();

/**
 * @swagger
 * /:
 *  post:
 *    summary: Register a new DID
 *    description: Register a new DID for a person or institution. The DID is written to the blockchain.
 *    tags:
 *      - "DID & Account Management"
 *    requestBody:
 *      required: true
 *      content:
 *        application/json:
 *          schema:
 *            type: object
 *            required:
 *              - did_string
 *              - public_key
 *              - role
 *            properties:
 *              did_string:
 *                type: string
 *                example: "did:example:123456789abcdefghi"
 *              public_key:
 *                type: string
 *                example: "0x04e6a..."
 *              role:
 *                type: string
 *                enum: [holder, issuer]
 *                example: "holder"
 *    responses:
 *      201:
 *        description: DID registered successfully.
 *        content:
 *          application/json:
 *            schema:
 *              type: object
 *              properties:
 *                message:
 *                  type: string
 *                  example: "DID registered successfully"
 *                did:
 *                  type: string
 *                  example: "did:example:123456789abcdefghi"
 *                transactionHash:
 *                  type: string
 *                  example: "0x..."
 *      400:
 *        description: Validation error.
 *      500:
 *        description: Failed to register DID.
 */
router.post(
  "/",
  [
    body("did_string", "A DID must not be empty!").trim().not().isEmpty(),
    body("public_key", "Public key must not be empty!").trim().not().isEmpty(),
    body("role", "Role must be either individual or institution!")
      .trim()
      .isIn(["individual", "institution"]),
  ],
  did.registerDID
);

/**
 * @swagger
 * /dids/{did}/key-rotation:
 *  put:
 *    summary: Rotate DID Key
 *    description: Rotate the key associated with a DID. The iteration number must be incremented.
 *    tags:
 *      - "DID & Account Management"
 *    parameters:
 *      - in: path
 *        name: did
 *        required: true
 *        schema:
 *          type: string
 *          description: The DID to rotate the key for.
 *          example: "did:example:123456789abcdefghi"
 *    requestBody:
 *      required: true
 *      content:
 *        application/json:
 *      schema:
 *        type: object
 *        required:
 *          - old_public_key
 *          - new_public_key
 *          - iteration_number
 *        properties:
 *          old_public_key:
 *            type: string
 *            example: "0x04e6a..."
 *          new_public_key:
 *            type: string
 *            example: "0x04e6b..."
 *          iteration_number:
 *            type: integer
 *            example: 2
 *    responses:
 *      200:
 *        description: DID key rotated successfully.
 *        content:
 *          application/json:
 *            schema:
 *              type: object
 *              properties:
 *                message:
 *                  type: string
 *                  example: "DID key rotated successfully"
 *      400:
 *        description: Validation error.
 *      500:
 *        description: Failed to rotate key.
 */
router.put(
  "/:did/key-rotation",
  [
    param("did", "DID in path must not be empty!").trim().not().isEmpty(),
    body("old_public_key", "Old public key must not be empty!")
      .trim()
      .not()
      .isEmpty(),
    body("new_public_key", "New public key must not be empty!")
      .trim()
      .not()
      .isEmpty(),
    body("iteration_number", "Iteration number must be an integer!")
      .isInt()
      .toInt(),
  ],
  did.keyRotation
);

/**
 * @swagger
 * /dids/{did}:
 *  delete:
 *    summary: Delete a Holder's Account
 *    description: Delete a holder's account and revoke all their associated VCs.
 *    tags:
 *      - "DID & Account Management"
 *    parameters:
 *      - in: path
 *        name: did
 *        required: true
 *        schema:
 *          type: string
 *          description: The DID of the account to delete.
 *          example: "did:example:123456789abcdefghi"
 *    responses:
 *      200:
 *        description: Account deleted successfully.
 *        content:
 *          application/json:
 *            schema:
 *              type: object
 *              properties:
 *                message:
 *                  type: string
 *                  example: "Account deleted successfully"
 *      404:
 *        description: DID not found.
 *      500:
 *        description: Failed to delete account.
 */
router.delete(
  "/:did",
  [param("did", "DID must not be empty!").trim().not().isEmpty()],
  did.deleteDID
);

/**
 * @swagger
 * /dids/{did}/document:
 *  get:
 *    summary: Get DID Document
 *    description: Fetch the public DID document for any DID. This is a public endpoint.
 *    tags:
 *      - "DID & Account Management"
 *    parameters:
 *      - in: path
 *        name: did
 *        required: true
 *        schema:
 *          type: string
 *          description: The DID to fetch the document for.
 *          example: "did:example:123456789abcdefghi"
 *    responses:
 *      200:
 *        description: DID document retrieved successfully.
 *        content:
 *          application/json:
 *            schema:
 *              type: object
 *              properties:
 *                did_document:
 *                  type: object
 *                  example:
 *                    "@context": "https://www.w3.org/ns/did/v1"
 *                    id: "did:example:123456789abcdefghi"
 *      404:
 *        description: DID Document not found.
 *      500:
 *        description: Failed to retrieve DID document.
 */
router.get(
  "/:did/document",
  [param("did", "DID must not be empty!").trim().not().isEmpty()],
  did.getDIDDocument
);

router.get(
  "/check/:did",
  [param("did", "DID must not be empty!").trim().not().isEmpty()],
  did.checkDID
);

router.get(
  "/blocks",
  did.numberofBlocks
);

export default router;
