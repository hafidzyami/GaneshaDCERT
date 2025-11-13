import { Request, Response } from "express";
import { validationResult } from "express-validator";
import { PresentationService } from "../services";
import { ValidationError } from "../utils";
import { asyncHandler } from "../middlewares";
import { ResponseHelper } from "../utils/helpers";
import { RequestWithDID } from "../middlewares/didAuth.middleware";

/**
 * Request VP Controller
 */
export const requestVP = asyncHandler(async (req: RequestWithDID, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError("Validation error", errors.array());
  }

  const { holder_did, verifier_did, verifier_name, purpose, requested_credentials } = req.body;

  const result = await PresentationService.requestVP({
    holder_did,
    verifier_did,
    verifier_name,
    purpose,
    requested_credentials,
  });

  return ResponseHelper.created(res, result, "VP request created successfully");
});

/**
 * Get VP Request Details Controller
 */
export const getVPRequestDetails = asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError("Validation error", errors.array());
  }

  const { vpReqId } = req.params;

  const result = await PresentationService.getVPRequestDetails(vpReqId);

  return ResponseHelper.success(res, result, "VP request details retrieved successfully");
});

/**
 * Get VP Requests with Filtering Controller
 */
export const getVPRequests = asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError("Validation error", errors.array());
  }

  const { verifier_did, holder_did, status } = req.query;

  const result = await PresentationService.getVPRequests({
    verifier_did: verifier_did as string,
    holder_did: holder_did as string,
    status: status as string,
  });

  return ResponseHelper.success(res, { requests: result }, "VP requests retrieved successfully");
});

/**
 * Accept VP Request Controller
 */
export const acceptVPRequest = asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError("Validation error", errors.array());
  }

  const { vpReqId, vpId } = req.query;
  const { credentials } = req.body;

  if (!vpReqId || !vpId) {
    throw new ValidationError("vpReqId and vpId are required", []);
  }

  const result = await PresentationService.acceptVPRequest({
    vpReqId: vpReqId as string,
    vpId: vpId as string,
    credentials,
  });

  return ResponseHelper.success(res, result, "VP request accepted successfully");
});

/**
 * Decline VP Request Controller
 */
export const declineVPRequest = asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError("Validation error", errors.array());
  }

  const { vpReqId } = req.query;

  if (!vpReqId) {
    throw new ValidationError("vpReqId is required", []);
  }

  const result = await PresentationService.declineVPRequest({
    vpReqId: vpReqId as string,
  });

  return ResponseHelper.success(res, result, "VP request declined successfully");
});

/**
 * Claim VP Controller (for Verifier)
 */
export const claimVP = asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError("Validation error", errors.array());
  }

  const { verifier_did } = req.body;

  if (!verifier_did) {
    throw new ValidationError("verifier_did is required", []);
  }

  const result = await PresentationService.claimVP({
    verifier_did,
  });

  return ResponseHelper.success(res, result, "VPs claimed successfully");
});

/**
 * Confirm VP Controller
 * Verifier confirms VPs have been saved to local storage
 */
export const confirmVP = asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError("Validation error", errors.array());
  }

  const { verifier_did, vp_ids } = req.body;

  const result = await PresentationService.confirmVP({
    verifier_did,
    vp_ids,
  });

  return ResponseHelper.success(res, result, result.message);
});

/**
 * Store VP Controller
 */
export const storeVP = asyncHandler(async (req: RequestWithDID, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError("Validation error", errors.array());
  }

  // Get holder_did from JWT authentication middleware
  const holder_did = req.holderDID;
  if (!holder_did) {
    throw new ValidationError("Holder DID not found in authentication token", []);
  }

  const { vp, is_barcode } = req.body;

  const result = await PresentationService.storeVP({
    holder_did,
    vp,
    is_barcode,
  });

  // Return only vp_id
  return ResponseHelper.created(res, { vp_id: result.vp_id }, "VP stored successfully");
});

/**
 * Get VP Controller
 */
export const getVP = asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError("Validation error", errors.array());
  }

  const { vpId } = req.params;

  const result = await PresentationService.getVP(vpId);

  return ResponseHelper.success(res, result, "VP retrieved successfully");
});

/**
 * Verify VP Controller
 */
export const verifyVP = asyncHandler(async (req: RequestWithDID, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError("Validation error", errors.array());
  }

  const { vpId } = req.params;

  // Get verifier's public key from middleware (optional, for logging)
  const verifierDID = req.holderDID;

  const result = await PresentationService.verifyVP(vpId);

  return ResponseHelper.success(res, result, "VP verification completed");
});
