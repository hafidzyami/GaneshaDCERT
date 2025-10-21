import { Request, Response } from "express";
import { validationResult } from "express-validator";
import { DIDService } from "../services";
import { ValidationError } from "../utils";
import { asyncHandler } from "../middlewares";
import { ResponseHelper } from "../utils/helpers";

/**
 * Register DID Controller
 */
export const registerDID = asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError("Validation error", errors.array());
  }

  const {
    did_string,
    public_key,
    role,
    email,
    name,
    phone,
    country,
    website,
    address,
  } = req.body;

  const result = await DIDService.registerDID({
    did_string,
    public_key,
    role,
    email,
    name,
    phone,
    country,
    website,
    address,
  });

  return ResponseHelper.created(res, result, "DID registered successfully");
});

/**
 * Check DID Controller
 */
export const checkDID = asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError("Validation error", errors.array());
  }

  const { did } = req.params;

  const result = await DIDService.checkDID(did);

  return ResponseHelper.success(res, result);
});

/**
 * Get Number of Blocks Controller
 */
export const numberofBlocks = asyncHandler(async (req: Request, res: Response) => {
  const result = await DIDService.getBlockCount();

  return ResponseHelper.success(res, result);
});

/**
 * Key Rotation Controller
 */
export const keyRotation = asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError("Validation error", errors.array());
  }

  const { new_public_key } = req.body;
  const { did } = req.params;

  const result = await DIDService.rotateKey(did, new_public_key);

  return ResponseHelper.success(res, result, "Key rotation successful");
});

/**
 * Delete DID Controller
 */
export const deleteDID = asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError("Validation error", errors.array());
  }

  const { did } = req.params;

  const result = await DIDService.deactivateDID(did);

  return ResponseHelper.success(res, result, "DID deactivated successfully");
});

/**
 * Get DID Document Controller
 */
export const getDIDDocument = asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError("Validation error", errors.array());
  }

  const { did } = req.params;

  const result = await DIDService.getDIDDocument(did);

  return ResponseHelper.success(res, result);
});
