import { Request, Response } from "express";
import { validationResult } from "express-validator";
import { AuthService } from "../services";
import { ValidationError } from "../utils";
import { asyncHandler } from "../middlewares";
import { ResponseHelper } from "../utils/helpers";

/**
 * Register Institution Controller
 */
export const registerInstitution = asyncHandler(async (req: Request, res: Response) => {
  // Validate input
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError("Validation error", errors.array());
  }

  const { name, email, phone, country, website, address } = req.body;

  const institution = await AuthService.registerInstitution({
    name,
    email,
    phone,
    country,
    website,
    address,
  });

  return ResponseHelper.created(
    res,
    {
      id: institution.id,
      name: institution.name,
      email: institution.email,
      status: institution.status,
    },
    "Registrasi berhasil. Menunggu persetujuan admin."
  );
});

/**
 * Get Pending Institutions Controller
 */
export const getPendingInstitutions = asyncHandler(async (req: Request, res: Response) => {
  const institutions = await AuthService.getPendingInstitutions();

  return ResponseHelper.success(res, institutions);
});

/**
 * Get All Institutions Controller
 */
export const getAllInstitutions = asyncHandler(async (req: Request, res: Response) => {
  const { status } = req.query;

  const institutions = await AuthService.getAllInstitutions(status as any);

  return ResponseHelper.success(res, institutions);
});

/**
 * Approve Institution Controller
 */
export const approveInstitution = asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError("Validation error", errors.array());
  }

  const { institutionId } = req.params;
  const { approvedBy } = req.body;

  const institution = await AuthService.approveInstitution(institutionId, approvedBy);

  return ResponseHelper.success(
    res,
    {
      id: institution.id,
      name: institution.name,
      email: institution.email,
      status: institution.status,
      approvedBy: institution.approvedBy,
      approvedAt: institution.approvedAt,
    },
    "Institusi berhasil disetujui dan magic link telah dikirim ke email"
  );
});

/**
 * Reject Institution Controller
 */
export const rejectInstitution = asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError("Validation error", errors.array());
  }

  const { institutionId } = req.params;

  const institution = await AuthService.rejectInstitution(institutionId);

  return ResponseHelper.success(
    res,
    {
      id: institution.id,
      name: institution.name,
      email: institution.email,
      status: institution.status,
    },
    "Institusi berhasil ditolak"
  );
});

/**
 * Verify Magic Link Controller
 */
export const verifyMagicLink = asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError("Validation error", errors.array());
  }

  const { token } = req.body;

  const result = await AuthService.verifyMagicLink(token);

  return ResponseHelper.success(res, result, "Login berhasil");
});

/**
 * Get Profile Controller
 */
export const getProfile = asyncHandler(async (req: Request, res: Response) => {
  const institutionId = req.institutionId!;

  const institution = await AuthService.getInstitutionProfile(institutionId);

  return ResponseHelper.success(res, {
    id: institution.id,
    name: institution.name,
    email: institution.email,
    phone: institution.phone,
    country: institution.country,
    website: institution.website,
    address: institution.address,
    status: institution.status,
    approvedBy: institution.approvedBy,
    approvedAt: institution.approvedAt,
    createdAt: institution.createdAt,
    updatedAt: institution.updatedAt,
  });
});
