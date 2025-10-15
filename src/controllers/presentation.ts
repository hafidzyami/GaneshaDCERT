import { RequestHandler } from "express";
import { validationResult } from "express-validator";
import { PrismaClient } from "@prisma/client";
import { v4 as uuidv4 } from "uuid";

import {
  throwCustomError,
  addStatusCodeTo,
  hasNoValidationErrors,
} from "../utils/error";

const prisma = new PrismaClient();

/**
 * Verifier requests a Verifiable Presentation (VP) from a holder.
 */
export const requestVP: RequestHandler = async (req, res, next) => {
  if (hasNoValidationErrors(validationResult(req))) {
    const { holder_did, verifier_did, list_schema_id } = req.body;

    try {
      const requestId = uuidv4();

      const vpRequest = await prisma.vPRequest.create({
        data: {
          holder_did,
          verifier_did,
          list_schema_id,
        },
      });

      // TODO: Add Message Queue using RabbitMQ with the corresponding DID.

      return res.status(201).json({
        message: "VP request sent successfully. Awaiting Holder's response.",
        vp_request_id: requestId,
      });
    } catch (error) {
      next(addStatusCodeTo(error as Error));
    }
  }
};

/**
 * Holder fetches the request VP to assign it.
 */
export const getVPRequestDetails: RequestHandler = async (req, res, next) => {
  if (hasNoValidationErrors(validationResult(req))) {
    const vpRequestId = req.params.vpReqId;

    try {
      const vpRequest = await prisma.vPRequest.findUnique({
        where: { vpRequestId },
      });

      if (!vpRequest) {
        throwCustomError("VP Request not found.", 404);
      }

      return res.status(201).json({
        verifier_did: vpRequest.verifier_did,
        list_schema_id: vpRequest.list_schema_id,
      });
    } catch (error) {
      next(addStatusCodeTo(error as Error));
    }
  }
};

/**
 * Holder creates and stores a VP in response to a request.
 */
export const storeVP: RequestHandler = async (req, res, next) => {
  if (hasNoValidationErrors(validationResult(req))) {
    const { holder_did, vp } = req.body;
    try {
      const sharedVp = await prisma.vPSharing.create({
        data: {
          holder_did,
          VP: vp,
        },
      });

      return res.status(201).json({
        message: "VP stored successfully and is available for retrieval.",
        vp_id: sharedVp.id,
      });
    } catch (error) {
      next(addStatusCodeTo(error as Error));
    }
  }
};

/**
 * Verifier fetches the stored VP to verify it.
 */
export const getVP: RequestHandler = async (req, res, next) => {
  if (hasNoValidationErrors(validationResult(req))) {
    const { vpId } = req.params;
    try {
      // Mencari VP di `VPSharing`.
      const sharedVp = await prisma.vPSharing.findUnique({
        where: { id: vpId },
      });

      if (!sharedVp) {
        throwCustomError(
          "VP not found. It may have expired or already been used.",
          404
        );
      }

      // Flow "get & delete VP from Redis"
      await prisma.vPSharing.delete({
        where: { id: vpId },
      });

      console.log(
        `Verifier already derive VP with VP_ID: ${vpId}. VP'll delete.`
      );

      return res.status(200).json({
        vp: sharedVp.VP,
      });
    } catch (error) {
      next(addStatusCodeTo(error as Error));
    }
  }
};
