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
export const requestVP = asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError("Validation error", errors.array());
  }

  const { holder_did, verifier_did, list_schema_id } = req.body;

  const result = await PresentationService.requestVP({
    holder_did,
    verifier_did,
    list_schema_id,
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

  const { vp } = req.body;

  const result = await PresentationService.storeVP({
    holder_did,
    vp,
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
