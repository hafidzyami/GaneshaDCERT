import { Request, Response } from "express";
import { validationResult } from "express-validator";
import SelectiveDisclosureService from "../services/selectiveDisclosure.service";
import { ValidationError } from "../utils";
import { asyncHandler } from "../middlewares";
import { ResponseHelper } from "../utils/helpers";
import { RequestWithDID } from "../middlewares/didAuth.middleware";

/**
 * Selective Disclosure Controllers
 * Handles ZKP-based selective disclosure VP endpoints
 */

/**
 * Create Selective Disclosure Request
 * Verifier creates a request specifying required attributes and predicates
 */
export const createSelectiveDisclosureRequest = asyncHandler(
  async (req: RequestWithDID, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError("Validation error", errors.array());
    }

    const {
      holderDID,
      verifierDID,
      verifierName,
      credentialTypes,
      purpose,
      domain,
      expiresIn,
      requestedAttributes,
      requestedPredicates,
    } = req.body;

    const result = await SelectiveDisclosureService.createSelectiveDisclosureRequest({
      holderDID,
      verifierDID,
      verifierName,
      credentialTypes,
      purpose,
      domain,
      expiresIn,
      requestedAttributes,
      requestedPredicates,
    });

    return ResponseHelper.created(
      res,
      result,
      "Selective disclosure request created successfully"
    );
  }
);

/**
 * Get Selective Disclosure Request Details
 * Get details of a specific selective disclosure request
 */
export const getSelectiveDisclosureRequest = asyncHandler(
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError("Validation error", errors.array());
    }

    const { requestId } = req.params;

    const result = await SelectiveDisclosureService.getSelectiveDisclosureRequest(
      requestId
    );

    return ResponseHelper.success(
      res,
      result,
      "Selective disclosure request retrieved successfully"
    );
  }
);

/**
 * Get Pending Selective Disclosure Requests for Holder
 * Holder retrieves their pending requests
 */
export const getPendingSelectiveDisclosureRequests = asyncHandler(
  async (req: RequestWithDID, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError("Validation error", errors.array());
    }

    // Get holder DID from query or from authenticated user
    let holderDID = req.query.holder_did as string;
    if (!holderDID && req.holderDID) {
      holderDID = req.holderDID;
    }

    if (!holderDID) {
      throw new ValidationError("Holder DID is required", []);
    }

    const result = await SelectiveDisclosureService.getPendingRequestsForHolder(
      holderDID
    );

    return ResponseHelper.success(
      res,
      { requests: result },
      "Pending selective disclosure requests retrieved successfully"
    );
  }
);

/**
 * Submit Selective Disclosure VP
 * Holder submits a selective disclosure VP with BBS+ proof
 */
export const submitSelectiveDisclosureVP = asyncHandler(
  async (req: RequestWithDID, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError("Validation error", errors.array());
    }

    const { requestId, selectiveVP } = req.body;

    const result = await SelectiveDisclosureService.submitSelectiveDisclosureVP({
      requestId,
      selectiveVP,
    });

    // Determine status code based on verification result
    const statusCode = result.valid ? 200 : 200; // Always 200, validity in response

    return ResponseHelper.success(
      res,
      result,
      result.valid
        ? "Selective disclosure VP verified successfully"
        : "Selective disclosure VP verification failed"
    );
  }
);

/**
 * Get Verification Result
 * Get the verification result for a submitted selective disclosure VP
 */
export const getVerificationResult = asyncHandler(
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError("Validation error", errors.array());
    }

    const { vpId } = req.params;

    const result = await SelectiveDisclosureService.getVerificationResult(vpId);

    if (!result) {
      return ResponseHelper.notFound(res, "Verification result not found");
    }

    return ResponseHelper.success(
      res,
      result,
      "Verification result retrieved successfully"
    );
  }
);

/**
 * Decline Selective Disclosure Request
 * Holder declines a selective disclosure request
 */
export const declineSelectiveDisclosureRequest = asyncHandler(
  async (req: RequestWithDID, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError("Validation error", errors.array());
    }

    const { requestId } = req.params;

    // Import prisma for direct update
    const { prisma } = await import("../config/database");

    // Update request status to DECLINE
    const updated = await prisma.selectiveDisclosureRequest.update({
      where: { id: requestId },
      data: { status: "DECLINE" },
    });

    return ResponseHelper.success(
      res,
      { requestId: updated.id, status: updated.status },
      "Selective disclosure request declined successfully"
    );
  }
);
