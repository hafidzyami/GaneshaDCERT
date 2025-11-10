import { Request, Response } from "express";
import { validationResult } from "express-validator";
import { AdminAuthService } from "../services";
import { ValidationError } from "../utils";
import { asyncHandler } from "../middlewares";
import { ResponseHelper } from "../utils/helpers";

/**
 * Admin Login Controller
 */
export const adminLogin = asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError("Validation error", errors.array());
  }

  const { email, password } = req.body;

  const result = await AdminAuthService.login(email, password);

  return ResponseHelper.success(res, result, "Login berhasil");
});

/**
 * Get Admin Profile Controller
 */
export const getAdminProfile = asyncHandler(async (req: Request, res: Response) => {
  const adminId = (req as any).adminId;

  const admin = await AdminAuthService.getProfile(adminId);

  return ResponseHelper.success(res, admin, "Admin profile retrieved successfully");
});

/**
 * Create Admin Controller
 */
export const createAdmin = asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError("Validation error", errors.array());
  }

  const { email, password, name } = req.body;

  const admin = await AdminAuthService.createAdmin({ email, password, name });

  return ResponseHelper.created(res, admin, "Admin berhasil dibuat");
});

/**
 * Change Password Controller
 */
export const changePassword = asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError("Validation error", errors.array());
  }

  const adminId = (req as any).adminId;
  const { currentPassword, newPassword } = req.body;

  await AdminAuthService.changePassword(adminId, currentPassword, newPassword);

  return ResponseHelper.success(res, null, "Password berhasil diubah");
});
