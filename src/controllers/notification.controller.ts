import { Request, Response } from "express";
import { validationResult } from "express-validator";
import { NotificationService } from "../services";
import { ValidationError } from "../utils";
import { asyncHandler } from "../middlewares";

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

  const statusCode = pushToken.createdAt === pushToken.updatedAt ? 201 : 200;
  const message =
    statusCode === 201
      ? "Push token registered successfully"
      : "Push token updated successfully";

  res.status(statusCode).json({
    success: true,
    message,
    data: pushToken,
  });
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

  res.status(200).json({
    success: true,
    message: "Push token unregistered successfully",
    data: pushToken,
  });
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

  res.status(200).json({
    success: true,
    data: tokens,
  });
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

  res.status(200).json({
    success: true,
    message: "Push notifications sent",
    data: result,
  });
});
