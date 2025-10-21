import { Request, Response } from "express";
import { validationResult } from "express-validator";
import { PresentationService } from "../services";
import { ValidationError } from "../utils";
import { asyncHandler } from "../middlewares";

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

  res.status(201).json(result);
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

  res.status(200).json(result);
});

/**
 * Store VP Controller
 */
export const storeVP = asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError("Validation error", errors.array());
  }

  const { holder_did, vp } = req.body;

  const result = await PresentationService.storeVP({
    holder_did,
    vp,
  });

  res.status(201).json(result);
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

  res.status(200).json(result);
});
