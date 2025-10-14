import express, { Router } from "express";
import { body, param } from "express-validator";

import * as did from "../controllers/did";

const router: Router = express.Router();

/**
 * @swagger
 * /dids:
 *   post:
 *     summary: API of DID Registry
 *     description: Created DID Document of Holder or Issuer
 *     tags:
 *       - Decentralization Identifiers
 *     responses:
 *       200:
 *         description: Message
 */
router.post(
  "/dids",
  [
    body("did_string", "A DID must not be empty!.").trim().not().isEmpty(),
    body("public_key", "Public key must not be empty!").trim().not().isEmpty(),
    body("role", "Role must not be empty!").trim().not().isEmpty(),
  ],
  did.person
);

/**
 * @swagger
 * /dids/{did}/key-rotation:
 *   put:
 *     summary: API of DID Key Rotation
 *     description: Rotated the key associated with a DID.
 *     tags:
 *       - Decentralization Identifiers
 *     responses:
 *       200:
 *         description: Message
 */
router.put(
  "/dids/:did/key-rotation",
  [
    param("did").trim().not().isEmpty(),
    body("did_string", "A DID Document already exists with this DID.")
      .trim()
      .not()
      .isEmpty(),
    body("public_key", "Public key must not be empty!").trim().not().isEmpty(),
    body("role", "Role must not be empty!").trim().not().isEmpty(),
  ],
  did.keyRotation
);

/**
 * @swagger
 * /dids/{did}:
 *   delete:
 *     summary: API of Delete DID
 *     description: Delete a holder's account and revoke all holder's VCs.
 *     tags:
 *       - Decentralization Identifiers
 *     responses:
 *       200:
 *         description: Message
 */
router.delete(
  "/dids/:did",
  [
    // Checking DID Path Variable in Params
    param("did").trim().not().isEmpty(),
  ],
  did.person
);

/**
 * @swagger
 * /dids/{did}/document:
 *   get:
 *     summary: API of Getting DID Document
 *     description: Fetch the public DID document for any DID.
 *     tags:
 *       - Decentralization Identifiers
 *     responses:
 *       200:
 *         description: Message
 */
router.delete(
  "/dids/:did/document",
  [
    // Checking DID Path Variable in Params
    param("did").trim().not().isEmpty(),
  ],
  did.person
);

export default router;
