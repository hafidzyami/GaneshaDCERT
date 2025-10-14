import express, { Router } from "express";
import { body } from "express-validator";

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
 *         description: API status
 */
router.post(
  "/dids",
  [
    body("did_string", "A DID Document already exists with this DID.").custom(
      (value: string) => {
        // Search DID in Blockchain
        // return User.findOne({ email: value }).then(userDoc => {
        //   if (userDoc) {
        //     // Jika user ditemukan, reject promise untuk menandakan validasi gagal
        //     return Promise.reject(
        //       'An account already exists with this email address.'
        //     );
        //   }
        // });
      }
    ),
    body("public_key", "Public key must not be empty!").trim().not().isEmpty(),
    body("role", "Role must not be empty!").trim().not().isEmpty(),
  ],
  did.person
);

export default router;
