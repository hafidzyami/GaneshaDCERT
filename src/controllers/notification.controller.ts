import { Request, Response } from "express";
import { validationResult } from "express-validator";
import { NotificationService } from "../services";
import { ValidationError } from "../utils";
import { asyncHandler } from "../middlewares";
import { ResponseHelper } from "../utils/helpers";

/**
 * Register Push Token Controller
 */
export const registerPushToken = asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError("Validation error", errors.array());
  }

  const { holder_did, token, deviceInfo } = req.body;

  const pushToken = await NotificationService.registerPushToken({
    holder_did,
    token,
    deviceInfo,
  });

  const isNewToken = pushToken.createdAt === pushToken.updatedAt;
  const message = isNewToken
    ? "Push token registered successfully"
    : "Push token updated successfully";

  // Use created (201) for new tokens, success (200) for updates
  if (isNewToken) {
    return ResponseHelper.created(res, pushToken, message);
  }
  return ResponseHelper.success(res, pushToken, message);
});

/**
 * Unregister Push Token Controller
 */
export const unregisterPushToken = asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError("Validation error", errors.array());
  }

  const { token } = req.body;

  const pushToken = await NotificationService.unregisterPushToken(token);

  return ResponseHelper.success(res, pushToken, "Push token unregistered successfully");
});

/**
 * Get Push Tokens By Holder Controller
 */
export const getPushTokensByHolder = asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError("Validation error", errors.array());
  }

  const { holder_did } = req.params;

  const tokens = await NotificationService.getPushTokensByHolder(holder_did);

  return ResponseHelper.success(res, tokens, "Push tokens retrieved successfully");
});

/**
 * Send Push Notification Controller
 */
export const sendPushNotification = asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError("Validation error", errors.array());
  }

  const { holder_dids, title, body, data } = req.body;

  const result = await NotificationService.sendPushNotification({
    holder_dids,
    title,
    body,
    data,
  });

  return ResponseHelper.success(res, result, "Push notifications sent");
});
