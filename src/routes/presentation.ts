import express, { Router } from "express";
import { body, param } from "express-validator";

import * as vp from "../controllers/presentation";

const router: Router = express.Router();

/**
 * @swagger
 * /presentation/requests:
 *  post:
 *    summary: Request a Verifiable Presentation
 *    description: A Verifier requests a Verifiable Presentation (VP) from a Holder. This is the starting point for the Verifier-initiated flow.
 *    tags:
 *      - "Verification & Presentation (VP) Flow"
 *    requestBody:
 *      required: true
 *      content:
 *        application/json:
 *          schema:
 *            type: object
 *            required:
 *              - holder_did
 *              - verifier_did
 *              - list_schema_id
 *            properties:
 *              holder_did:
 *                type: string
 *                example: "did:example:holder123"
 *              verifier_did:
 *                type: string
 *                example: "did:example:verifier456"
 *              list_schema_id:
 *                type: array
 *                items:
 *                  type: string
 *                  example: ["sch:hid:12345", "sch:hid:67890"]
 *    responses:
 *      201:
 *        description: VP request sent successfully.
 *        content:
 *          application/json:
 *            schema:
 *              type: object
 *              properties:
 *                message:
 *                  type: string
 *                vp_request_id:
 *                  type: string
 */
router.post(
  "/requests",
  [
    body("holder_did", "Holder DID is required").not().isEmpty(),
    body("verifier_did", "Verifier DID is required").not().isEmpty(),
    body(
      "list_schema_id",
      "List of schema IDs must be an array with at least one item"
    ).isArray({ min: 1 }),
  ],
  vp.requestVP
);

/**
 * @swagger
 * /api/presentations/{vpReqId}:
 *  get:
 *    summary: Holder fetches the request VP
 *    description: A Holder fetches the details of a VP request to see what is being asked for.
 *    tags:
 *      - "Verification & Presentation (VP) Flow"
 *    parameters:
 *      - in: path
 *        name: vpReqId
 *        required: true
 *        schema:
 *          type: string
 *          format: uuid
 *          description: The unique ID of the VP request.
 *    responses:
 *      200:
 *        description: VP request details retrieved successfully.
 *        content:
 *          application/json:
 *            schema:
 *              type: object
 *              properties:
 *                verifier_did:
 *                  type: string
 *                list_schema_id:
 *                  type: array
 *                  items:
 *                    type: string
 *      404:
 *        description: VP request not found.
 */
router.get(
  "/presentations/:vpReqId",
  [param("vpReqId", "A valid VP Request ID is required").isUUID()],
  vp.getVPRequestDetails
);

/**
 * @swagger
 * /presentations:
 *  post:
 *    summary: Store a Verifiable Presentation
 *    description: A Holder creates and stores a VP, making it available for a Verifier to fetch. This is part of the Holder-initiated flow.
 *    tags:
 *      - "Verification & Presentation (VP) Flow"
 *    requestBody:
 *      required: true
 *      content:
 *        application/json:
 *          schema:
 *            type: object
 *            required:
 *              - holder_did
 *              - vp
 *            properties:
 *              holder_did:
 *                type: string
 *                example: "did:example:holder123"
 *              vp:
 *                type: object
 *                description: The Verifiable Presentation JSON object.
 *                example:
 *                  "@context": ["https://www.w3.org/2018/credentials/v1"]
 *                  type: ["VerifiablePresentation"]
 *                  verifiableCredential: [{}]
 *    responses:
 *      201:
 *        description: VP stored successfully.
 *        content:
 *          application/json:
 *            schema:
 *              type: object
 *              properties:
 *                message:
 *                  type: string
 *                vp_id:
 *                  type: string
 */
router.post(
  "/",
  [
    body("holder_did", "Holder DID is required").not().isEmpty(),
    body("vp", "VP object is required").isObject(),
  ],
  vp.storeVP
);

/**
 * @swagger
 * /presentations/{vpId}:
 *  get:
 *    summary: Fetch a stored Verifiable Presentation
 *    description: A Verifier fetches the stored VP using its unique ID to verify it. The VP is deleted after being fetched.
 *    tags:
 *      - "Verification & Presentation (VP) Flow"
 *    parameters:
 *      - in: path
 *        name: vpId
 *        required: true
 *        schema:
 *          type: string
 *          format: uuid
 *          description: The unique ID of the stored VP.
 *    responses:
 *      200:
 *        description: VP retrieved successfully.
 *        content:
 *          application/json:
 *            schema:
 *              type: object
 *              properties:
 *                vp:
 *                  type: object
 *      404:
 *        description: VP not found or already used.
 */
router.get(
  "/:vpId",
  [param("vpId", "A valid VP ID is required").isUUID()],
  vp.getVP
);

export default router;
