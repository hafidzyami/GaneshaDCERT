import { Request, Response } from "express";
import { validationResult } from "express-validator";
import AuthService from "../services/auth.service";
import { ValidationError } from "../utils/errors/AppError";
import { asyncHandler } from "../middlewares/errorHandler.middleware";

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

  res.status(201).json({
    success: true,
    message: "Registrasi berhasil. Menunggu persetujuan admin.",
    data: {
      id: institution.id,
      name: institution.name,
      email: institution.email,
      status: institution.status,
    },
  });
});

/**
 * Get Pending Institutions Controller
 */
export const getPendingInstitutions = asyncHandler(async (req: Request, res: Response) => {
  const institutions = await AuthService.getPendingInstitutions();

  res.status(200).json({
    success: true,
    data: institutions,
  });
});

/**
 * Get All Institutions Controller
 */
export const getAllInstitutions = asyncHandler(async (req: Request, res: Response) => {
  const { status } = req.query;

  const institutions = await AuthService.getAllInstitutions(
    status as any
  );

  res.status(200).json({
    success: true,
    data: institutions,
  });
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

  const institution = await AuthService.approveInstitution(
    institutionId,
    approvedBy
  );

  res.status(200).json({
    success: true,
    message: "Institusi berhasil disetujui dan magic link telah dikirim ke email",
    data: {
      id: institution.id,
      name: institution.name,
      email: institution.email,
      status: institution.status,
      approvedBy: institution.approvedBy,
      approvedAt: institution.approvedAt,
    },
  });
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

  res.status(200).json({
    success: true,
    message: "Institusi berhasil ditolak",
    data: {
      id: institution.id,
      name: institution.name,
      email: institution.email,
      status: institution.status,
    },
  });
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

  res.status(200).json({
    success: true,
    message: "Login berhasil",
    data: result,
  });
});

/**
 * Get Profile Controller
 */
export const getProfile = asyncHandler(async (req: Request, res: Response) => {
  const institutionId = (req as any).institutionId;

  const institution = await AuthService.getInstitutionProfile(institutionId);

  res.status(200).json({
    success: true,
    data: {
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
    },
  });
});
