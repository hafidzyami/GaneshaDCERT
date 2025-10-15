import { RequestHandler } from "express";
import { validationResult } from "express-validator";
import { PrismaClient, RequestType } from "@prisma/client";
import { hasNoValidationErrors, addStatusCodeTo, throwCustomError } from "../utils/error";


const prisma = new PrismaClient();

export const requestCredential: RequestHandler = async (req, res, next) => {
  if (hasNoValidationErrors(validationResult(req))) {
    try {
      const { encrypted_body, issuer_did, holder_did } = req.body;

      // Create a new VCIssuanceRequest record using the new schema
      const newRequest = await prisma.vCIssuanceRequest.create({
        data: {
          encrypted_body: encrypted_body,
          issuer_did: issuer_did,
          holder_did: holder_did,
        },
      });

      // Send the successful response
      res.status(201).json({
        message:
          "Verifiable Credential request has been successfully submitted.",
        request_id: newRequest.id,
      });
    } catch (error) {
      next(addStatusCodeTo(error as Error));
    }
  }
};

export const getCredentialRequestsByType: RequestHandler = async (req, res, next) => {
  if (hasNoValidationErrors(validationResult(req))) {
    try {
      const { type, issuer_did } = req.query; // Get issuer_did from query
      let requests;

      // Build a dynamic where clause
      const whereClause: { issuer_did?: string } = {};
      if (issuer_did) {
        whereClause.issuer_did = issuer_did as string;
      }

      switch (type) {
        case RequestType.ISSUANCE:
          requests = await prisma.vCIssuanceRequest.findMany({
            where: whereClause, // Apply the where clause
            orderBy: { createdAt: 'desc' }
          });
          break;
        case RequestType.RENEWAL:
          requests = await prisma.vCRenewalRequest.findMany({
            where: whereClause, // Apply the where clause
            orderBy: { createdAt: 'desc' }
          });
          break;
        case RequestType.UPDATE:
          requests = await prisma.vCUpdateRequest.findMany({
            where: whereClause, // Apply the where clause
            orderBy: { createdAt: 'desc' }
          });
          break;
        case RequestType.REVOKE:
          requests = await prisma.vCRevokeRequest.findMany({
            where: whereClause, // Apply the where clause
            orderBy: { createdAt: 'desc' }
          });
          break;
        default:
          throwCustomError("Invalid request type specified.", 400);
          return;
      }

      res.status(200).json({
        message: `Successfully retrieved ${type} requests.`,
        count: requests.length,
        data: requests,
      });

    } catch (error) {
      next(addStatusCodeTo(error as Error));
    }
  }
};

export const issueCredential: RequestHandler = async (req, res, next) => {
  if (hasNoValidationErrors(validationResult(req))) {
    try {
      const { 
        request_id, 
        issuer_did, 
        holder_did, 
        encrypted_body 
      } = req.body;

      // Create a new VCResponse record to store the issued VC
      const newVCResponse = await prisma.vCResponse.create({
        data: {
          request_id: request_id,
          request_type: RequestType.ISSUANCE, // Set request type to ISSUANCE
          issuer_did: issuer_did,
          holder_did: holder_did,
          encrypted_body: encrypted_body,
        },
      });

      // Send the successful response
      res.status(201).json({
        message: "VC issued successfully",
        vc_response_id: newVCResponse.id,
      });
    } catch (error) {
      next(addStatusCodeTo(error as Error));
    }
  }
};