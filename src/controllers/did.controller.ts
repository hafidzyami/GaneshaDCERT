import { Response } from "express";
import { validationResult } from "express-validator";
import { DIDService } from "../services";
import { ValidationError } from "../utils";
import { asyncHandler, RequestWithInstitution } from "../middlewares";
import { ResponseHelper } from "../utils/helpers";

/**
 * Register DID Controller
 * Supports both individual and institution registration
 * Institution requires valid MagicLink token
 */
export const registerDID = asyncHandler(
  async (req: RequestWithInstitution, res: Response) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      // Debug: Log validation errors
      console.log(
        "❌ Validation Errors:",
        JSON.stringify(errors.array(), null, 2)
      );

      throw new ValidationError("Validation error", errors.array());
    }

    const { did_string, public_key, role, email } = req.body;

    // For institution, use authenticated institution data from middleware
    let institutionEmail = email;
    if (role === "institution" && req.institutionData) {
      // Use email from authenticated institution
      institutionEmail = req.institutionData.email;

      // Optional: Log for audit trail
      console.log(
        `✅ Institution authenticated: ${req.institutionData.name} (${req.institutionData.email})`
      );
    }

    const result = await DIDService.registerDID({
      did_string,
      public_key,
      role,
      email: institutionEmail,
    });

    return ResponseHelper.created(res, result, "DID registered successfully");
  }
);

/**
 * Check DID Controller
 * Returns 200 even if DID not found
 */
export const checkDID = asyncHandler(
  async (req: RequestWithInstitution, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError("Validation error", errors.array());
    }

    const { did } = req.params;

    const result = await DIDService.checkDID(did);

    // Return 200 with appropriate message
    if (!result.found) {
      return ResponseHelper.success(res, result, result.message);
    }

    return ResponseHelper.success(res, result);
  }
);

/**
 * Number of Blocks Controller
 */
export const numberofBlocks = asyncHandler(
  async (req: RequestWithInstitution, res: Response) => {
    const result = await DIDService.getBlockCount();

    return ResponseHelper.success(res, result);
  }
);

/**
 * Key Rotation Controller
 * Returns 404 if DID not found
 */
export const keyRotation = asyncHandler(
  async (req: RequestWithInstitution, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError("Validation error", errors.array());
    }

    const { did } = req.params;
    const { new_public_key, signature, reason } = req.body;

    const result = await DIDService.rotateKey(did, new_public_key);

    return ResponseHelper.success(res, result, result.message);
  }
);

/**
 * Delete DID Controller
 * Returns 404 if DID not found
 */
export const deleteDID = asyncHandler(
  async (req: RequestWithInstitution, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError("Validation error", errors.array());
    }

    const { did } = req.params;
    const { signature, reason } = req.body;

    const result = await DIDService.deactivateDID(did);

    return ResponseHelper.success(res, result, result.message);
  }
);

/**
 * Get DID Document Controller
 * Returns 200 even if DID not found
 */
export const getDIDDocument = asyncHandler(
  async (req: RequestWithInstitution, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError("Validation error", errors.array());
    }

    const { did } = req.params;

    const result = await DIDService.getDIDDocument(did);

    // Handle bigint serialization
    const sanitizedDocument = JSON.parse(
      JSON.stringify(result, (key, value) =>
        typeof value === "bigint" ? value.toString() : value
      )
    );

    // Return 200 with appropriate message
    if (!sanitizedDocument.found) {
      return ResponseHelper.success(
        res,
        sanitizedDocument,
        sanitizedDocument.message
      );
    }

    return ResponseHelper.success(res, sanitizedDocument);
  }
);
