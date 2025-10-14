import { RequestHandler } from "express";
import { validationResult } from "express-validator";
import { PrismaClient } from "@prisma/client";
import { hasNoValidationErrors, addStatusCodeTo } from "../utils/error";

const prisma = new PrismaClient();

export const requestCredential: RequestHandler = async (req, res, next) => {
  if (hasNoValidationErrors(validationResult(req))) {
    try {
      const { encrypted_body, issuer_did, holder_did } = req.body;

      // Create a new VCIssuanceRequest record using the new schema
      const newRequest = await prisma.vCIssuanceRequest.create({
        data: {
          encrypted_body: encrypted_body, // Correctly maps to the new 'encrypted_body' field
          issuer_did: issuer_did,
          holder_did: holder_did,
        },
      });

      // Send the successful response
      res.status(201).json({
        message: "Verifiable Credential request has been successfully submitted.",
        request_id: newRequest.id,
      });

    } catch (error) {
      next(addStatusCodeTo(error as Error));
    }
  }
};
