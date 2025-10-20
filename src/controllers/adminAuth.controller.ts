import { Request, Response } from "express";
import { validationResult } from "express-validator";
import AdminAuthService from "../services/adminAuth.service";
import { ValidationError } from "../utils/errors/AppError";
import { asyncHandler } from "../middlewares/errorHandler.middleware";

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

  res.status(200).json({
    success: true,
    message: "Login berhasil",
    data: result,
  });
});

/**
 * Get Admin Profile Controller
 */
export const getAdminProfile = asyncHandler(async (req: Request, res: Response) => {
  const adminId = (req as any).adminId;

  const admin = await AdminAuthService.getProfile(adminId);

  res.status(200).json({
    success: true,
    data: admin,
  });
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

  res.status(201).json({
    success: true,
    message: "Admin berhasil dibuat",
    data: admin,
  });
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

  res.status(200).json({
    success: true,
    message: "Password berhasil diubah",
  });
});
