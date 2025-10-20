import { Request, Response } from "express";
import { validationResult } from "express-validator";
import DIDService from "../services/did.service";
import { ValidationError } from "../utils/errors/AppError";
import { asyncHandler } from "../middlewares/errorHandler.middleware";

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

  res.status(201).json(result);
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

  res.status(200).json(result);
});

/**
 * Get Number of Blocks Controller
 */
export const numberofBlocks = asyncHandler(async (req: Request, res: Response) => {
  const result = await DIDService.getBlockCount();

  res.status(200).json(result);
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

  res.status(200).json(result);
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

  res.status(200).json(result);
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

  res.status(200).json(result);
});
