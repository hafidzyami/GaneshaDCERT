import { Request, Response } from "express";
import { validationResult } from "express-validator";
import { PaymentService } from "../services";
import { ValidationError } from "../utils";
import { asyncHandler } from "../middlewares";
import { ResponseHelper } from "../utils/helpers";

/**
 * Function to make payment transaction via DOKU API
 */
export const createPaymentTransaction = asyncHandler(
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError("Validation error", errors.array());
    }

    const { holder_did, item_ids } = req.body;

    const config = {
      holder_did,
      item_ids
    };

    const result = await PaymentService.createTransaction(config);

    return ResponseHelper.success(
      res,
      result,
      'Payment transaction created successfully'
    );
  }
);

/**
 * Handle DOKU VA payment notification webhook
 * This endpoint is called by DOKU when a payment is completed
 */
export const handleVAPaymentNotification = asyncHandler(
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError("Validation error", errors.array());
    }

    const notificationData = req.body;
    const result = await PaymentService.handleVAPaymentNotification(notificationData);

    return res.status(200).json(result);
  }
);