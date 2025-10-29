import { Request, Response } from "express";
import { validationResult } from "express-validator";
import { InstitutionService } from "../services";
import { ValidationError } from "../utils";
import { asyncHandler } from "../middlewares";
import { ResponseHelper } from "../utils/helpers";
import { GetInstitutionsQueryDTO } from "../dtos";

/**
 * Get all institutions with pagination and filtering
 */
export const getAllInstitutions = asyncHandler(
  async (req: Request, res: Response) => {
    // Validate query parameters
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError("Validation error", errors.array());
    }

    // Extract and cast query parameters
    const queryData: GetInstitutionsQueryDTO = {
      page: req.query.page ? parseInt(req.query.page as string) : 1,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 10,
      search: req.query.search as string | undefined,
      country: req.query.country as string | undefined,
      sortBy: req.query.sortBy as "name" | "createdAt" | "updatedAt" | undefined,
      sortOrder: req.query.sortOrder as "asc" | "desc" | undefined,
    };

    // Call service
    const result = await InstitutionService.getAllInstitutions(queryData);

    // Send response
    return ResponseHelper.success(
      res,
      result,
      `Successfully retrieved ${result.institutions.length} institutions`
    );
  }
);

/**
 * Get institution by DID
 */
export const getInstitutionByDID = asyncHandler(
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError("Validation error", errors.array());
    }

    const { did } = req.params;

    const institution = await InstitutionService.getInstitutionByDID(did);

    return ResponseHelper.success(
      res,
      institution,
      "Institution retrieved successfully"
    );
  }
);

/**
 * Update institution by DID
 */
export const updateInstitution = asyncHandler(
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError("Validation error", errors.array());
    }

    const { did } = req.params;
    const updateData = req.body;

    const updatedInstitution = await InstitutionService.updateInstitution(
      did,
      updateData
    );

    return ResponseHelper.success(
      res,
      updatedInstitution,
      "Institution updated successfully"
    );
  }
);

/**
 * Delete institution by DID
 */
export const deleteInstitution = asyncHandler(
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError("Validation error", errors.array());
    }

    const { did } = req.params;

    const result = await InstitutionService.deleteInstitution(did);

    return ResponseHelper.success(
      res,
      result,
      result.message
    );
  }
);
