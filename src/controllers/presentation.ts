/**
 * Presentation Controller
 * Handles all Verifiable Presentation (VP) operations
 * Enhanced with proper validation, verification, and logging
 */

import { RequestHandler } from "express";
import { validationResult } from "express-validator";
import { PrismaClient } from "@prisma/client";

import { throwCustomError, addStatusCodeTo } from "../utils/error";
import {
  formatSuccessResponse,
  formatErrorResponse,
  formatValidationErrorResponse,
} from "../utils/responseFormatter";
import {
  validateVPStructure,
  validateVCsInVP,
  validateVPHolder,
  validateRequestedSchemas,
} from "../utils/validators/vpValidator";
import { validateDIDFormat } from "../utils/validators/didValidator";
import vpVerificationService from "../services/vpVerificationService";
import Logger from "../services/logger";

const prisma = new PrismaClient();
const logger = new Logger("PresentationController");

/**
 * Verifier requests a Verifiable Presentation from a Holder
 *
 * Flow:
 * 1. Validate input
 * 2. Validate DIDs
 * 3. Store VP request in database
 * 4. (Future) Notify holder via RabbitMQ
 * 5. Return request ID
 */
export const requestVP: RequestHandler = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn("Validation failed for VP request", {
        errors: errors.array(),
      });
      return res
        .status(400)
        .json(formatValidationErrorResponse(errors.array()));
    }

    const { holder_did, verifier_did, list_schema_id } = req.body;

    logger.info("Processing VP request", {
      holder: holder_did,
      verifier: verifier_did,
      schemas: list_schema_id,
    });

    // Validate holder DID format
    const holderDIDValidation = validateDIDFormat(holder_did);
    if (!holderDIDValidation.isValid) {
      logger.warn("Invalid holder DID format", { did: holder_did });
      return res
        .status(400)
        .json(
          formatErrorResponse(
            "Invalid holder DID format",
            holderDIDValidation.error
          )
        );
    }

    // Validate verifier DID format
    const verifierDIDValidation = validateDIDFormat(verifier_did);
    if (!verifierDIDValidation.isValid) {
      logger.warn("Invalid verifier DID format", { did: verifier_did });
      return res
        .status(400)
        .json(
          formatErrorResponse(
            "Invalid verifier DID format",
            verifierDIDValidation.error
          )
        );
    }

    // Create VP request
    const vpRequest = await prisma.vPRequest.create({
      data: {
        holder_did,
        verifier_did,
        list_schema_id,
      },
    });

    logger.info("VP request created successfully", {
      requestId: vpRequest.id,
      holder: holder_did,
      verifier: verifier_did,
    });

    // TODO: Send notification to holder via RabbitMQ
    // await rabbitmqService.publishMessage('vp.request.created', {
    //   requestId: vpRequest.id,
    //   holder_did,
    //   verifier_did,
    //   list_schema_id
    // });

    return res.status(201).json(
      formatSuccessResponse(
        "VP request sent successfully. Awaiting Holder's response.",
        {
          vp_request_id: vpRequest.id,
          holder_did,
          verifier_did,
          requested_schemas: list_schema_id,
          created_at: vpRequest.createdAt,
        }
      )
    );
  } catch (error) {
    logger.error("Error creating VP request", error);
    next(addStatusCodeTo(error as Error));
  }
};

/**
 * Holder fetches VP request details
 *
 * Flow:
 * 1. Validate request ID
 * 2. Fetch request from database
 * 3. Return request details
 */
export const getVPRequestDetails: RequestHandler = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res
        .status(400)
        .json(formatValidationErrorResponse(errors.array()));
    }

    const { vpReqId } = req.params;

    logger.debug("Fetching VP request details", { requestId: vpReqId });

    const vpRequest = await prisma.vPRequest.findUnique({
      where: { id: vpReqId },
    });

    if (!vpRequest) {
      logger.warn("VP request not found", { requestId: vpReqId });
      return res
        .status(404)
        .json(
          formatErrorResponse(
            "VP request not found",
            "The specified VP request does not exist or has expired"
          )
        );
    }

    logger.debug("VP request details retrieved", { requestId: vpReqId });

    return res.status(200).json(
      formatSuccessResponse("VP request details retrieved successfully", {
        request_id: vpRequest.id,
        verifier_did: vpRequest.verifier_did,
        holder_did: vpRequest.holder_did,
        requested_schemas: vpRequest.list_schema_id,
        created_at: vpRequest.createdAt,
      })
    );
  } catch (error) {
    logger.error("Error fetching VP request details", error);
    next(addStatusCodeTo(error as Error));
  }
};

/**
 * Get all VP requests for a holder or verifier
 * NEW ENDPOINT
 *
 * Flow:
 * 1. Validate DID
 * 2. Query requests by holder_did or verifier_did
 * 3. Return list of requests
 */
export const getVPRequests: RequestHandler = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res
        .status(400)
        .json(formatValidationErrorResponse(errors.array()));
    }

    const { did, role } = req.query;

    logger.debug("Fetching VP requests", { did, role });

    // Validate DID format
    const didValidation = validateDIDFormat(did as string);
    if (!didValidation.isValid) {
      return res
        .status(400)
        .json(formatErrorResponse("Invalid DID format", didValidation.error));
    }

    // Build query based on role
    const whereClause =
      role === "holder"
        ? { holder_did: did as string }
        : { verifier_did: did as string };

    const requests = await prisma.vPRequest.findMany({
      where: whereClause,
      orderBy: {
        createdAt: "desc",
      },
    });

    logger.info("VP requests retrieved", {
      did,
      role,
      count: requests.length,
    });

    return res.status(200).json(
      formatSuccessResponse("VP requests retrieved successfully", {
        requests: requests.map((req) => ({
          request_id: req.id,
          holder_did: req.holder_did,
          verifier_did: req.verifier_did,
          requested_schemas: req.list_schema_id,
          created_at: req.createdAt,
        })),
        count: requests.length,
      })
    );
  } catch (error) {
    logger.error("Error fetching VP requests", error);
    next(addStatusCodeTo(error as Error));
  }
};

/**
 * Holder stores a VP (creates presentation)
 *
 * Flow:
 * 1. Validate input
 * 2. Validate VP structure (W3C compliance)
 * 3. Validate VCs within VP
 * 4. Store VP temporarily
 * 5. Return VP ID for retrieval
 */
export const storeVP: RequestHandler = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn("Validation failed for VP storage", {
        errors: errors.array(),
      });
      return res
        .status(400)
        .json(formatValidationErrorResponse(errors.array()));
    }

    const { holder_did, vp } = req.body;

    logger.info("Processing VP storage request", { holder: holder_did });

    // Validate holder DID format
    const holderDIDValidation = validateDIDFormat(holder_did);
    if (!holderDIDValidation.isValid) {
      logger.warn("Invalid holder DID format", { did: holder_did });
      return res
        .status(400)
        .json(
          formatErrorResponse(
            "Invalid holder DID format",
            holderDIDValidation.error
          )
        );
    }

    // Validate VP structure
    const vpStructureValidation = validateVPStructure(vp);
    if (!vpStructureValidation.isValid) {
      logger.warn("Invalid VP structure", {
        error: vpStructureValidation.error,
      });
      return res
        .status(400)
        .json(
          formatErrorResponse(
            "Invalid VP structure",
            vpStructureValidation.error,
            vpStructureValidation.details
          )
        );
    }

    // Validate VCs within VP
    const vcsValidation = validateVCsInVP(vp.verifiableCredential || []);
    if (!vcsValidation.isValid) {
      logger.warn("Invalid VCs in VP", { error: vcsValidation.error });
      return res
        .status(400)
        .json(
          formatErrorResponse(
            "Invalid VCs in VP",
            vcsValidation.error,
            vcsValidation.details
          )
        );
    }

    // Validate VP holder matches provided holder_did
    const holderValidation = validateVPHolder(vp, holder_did);
    if (!holderValidation.isValid) {
      logger.warn("VP holder mismatch", { error: holderValidation.error });
      return res
        .status(400)
        .json(
          formatErrorResponse(
            "VP holder mismatch",
            holderValidation.error,
            holderValidation.details
          )
        );
    }

    // Store VP
    // NOTE: In production, use Redis with TTL for temporary storage
    const sharedVp = await prisma.vPSharing.create({
      data: {
        holder_did,
        VP: vp,
      },
    });

    logger.info("VP stored successfully", {
      vpId: sharedVp.id,
      holder: holder_did,
    });

    return res.status(201).json(
      formatSuccessResponse(
        "VP stored successfully and is available for retrieval",
        {
          vp_id: sharedVp.id,
          holder_did,
          vc_count: vp.verifiableCredential?.length || 0,
          // created_at: sharedVp.createdAt,
          // Note: VP will be deleted after first retrieval
        }
      )
    );
  } catch (error) {
    logger.error("Error storing VP", error);
    next(addStatusCodeTo(error as Error));
  }
};

/**
 * Verifier fetches stored VP
 *
 * Flow:
 * 1. Validate VP ID
 * 2. Fetch VP from database
 * 3. Delete VP after retrieval (one-time use)
 * 4. Return VP data
 */
export const getVP: RequestHandler = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res
        .status(400)
        .json(formatValidationErrorResponse(errors.array()));
    }

    const { vpId } = req.params;

    logger.info("Fetching stored VP", { vpId });

    // Find VP
    const sharedVp = await prisma.vPSharing.findUnique({
      where: { id: vpId },
    });

    if (!sharedVp) {
      logger.warn("VP not found", { vpId });
      return res
        .status(404)
        .json(
          formatErrorResponse(
            "VP not found",
            "VP not found. It may have expired or already been used."
          )
        );
    }

    // Delete VP after retrieval (one-time use pattern)
    await prisma.vPSharing.delete({
      where: { id: vpId },
    });

    logger.info("VP retrieved and deleted", {
      vpId,
      holder: sharedVp.holder_did,
    });

    return res.status(200).json(
      formatSuccessResponse("VP retrieved successfully", {
        vp: sharedVp.VP,
        holder_did: sharedVp.holder_did,
        note: "VP has been deleted and cannot be retrieved again",
      })
    );
  } catch (error) {
    logger.error("Error fetching VP", error);
    next(addStatusCodeTo(error as Error));
  }
};

/**
 * Verify a Verifiable Presentation
 * NEW ENDPOINT
 *
 * Flow:
 * 1. Validate input
 * 2. Validate VP structure
 * 3. Verify VP cryptographic proof
 * 4. Verify all VCs within VP
 * 5. Check revocation status
 * 6. Check expiration
 * 7. Return verification result
 */
export const verifyVP: RequestHandler = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn("Validation failed for VP verification", {
        errors: errors.array(),
      });
      return res
        .status(400)
        .json(formatValidationErrorResponse(errors.array()));
    }

    const { vp, verifier_did, requested_schemas } = req.body;

    logger.info("Processing VP verification request", {
      verifier: verifier_did,
    });

    // Validate verifier DID format
    if (verifier_did) {
      const verifierDIDValidation = validateDIDFormat(verifier_did);
      if (!verifierDIDValidation.isValid) {
        return res
          .status(400)
          .json(
            formatErrorResponse(
              "Invalid verifier DID format",
              verifierDIDValidation.error
            )
          );
      }
    }

    // Validate VP structure
    const vpStructureValidation = validateVPStructure(vp);
    if (!vpStructureValidation.isValid) {
      logger.warn("Invalid VP structure for verification", {
        error: vpStructureValidation.error,
      });
      return res
        .status(400)
        .json(
          formatErrorResponse(
            "Invalid VP structure",
            vpStructureValidation.error,
            vpStructureValidation.details
          )
        );
    }

    // Validate VCs structure
    const vcsValidation = validateVCsInVP(vp.verifiableCredential || []);
    if (!vcsValidation.isValid) {
      logger.warn("Invalid VCs structure in VP", {
        error: vcsValidation.error,
      });
      return res
        .status(400)
        .json(
          formatErrorResponse(
            "Invalid VCs in VP",
            vcsValidation.error,
            vcsValidation.details
          )
        );
    }

    // If requested schemas provided, validate VP contains them
    if (requested_schemas && requested_schemas.length > 0) {
      const schemasValidation = validateRequestedSchemas(vp, requested_schemas);
      if (!schemasValidation.isValid) {
        logger.warn("VP missing requested schemas", {
          error: schemasValidation.error,
        });
        return res
          .status(400)
          .json(
            formatErrorResponse(
              "VP missing requested credentials",
              schemasValidation.error,
              schemasValidation.details
            )
          );
      }
    }

    // Perform complete VP verification (crypto + VCs)
    const verificationResult = await vpVerificationService.verifyCompleteVP(vp);

    logger.info("VP verification completed", {
      vpVerified: verificationResult.vpVerified,
      allValid: verificationResult.allValid,
      vcsCount: verificationResult.vcsVerified.length,
    });

    // Determine overall status
    const statusCode = verificationResult.allValid ? 200 : 400;
    const message = verificationResult.allValid
      ? "VP verification successful"
      : "VP verification failed";

    return res.status(statusCode).json(
      formatSuccessResponse(message, {
        verified: verificationResult.allValid,
        vp_verification: {
          proof_verified: verificationResult.vpVerified,
          error: verificationResult.vpError,
        },
        vcs_verification: verificationResult.vcsVerified,
        holder: vp.holder,
        vc_count: vp.verifiableCredential?.length || 0,
        verified_at: new Date().toISOString(),
      })
    );
  } catch (error) {
    logger.error("Error verifying VP", error);
    next(addStatusCodeTo(error as Error));
  }
};
