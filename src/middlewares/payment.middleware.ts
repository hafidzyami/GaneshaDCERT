import { Request, Response, NextFunction } from "express";
import { HTTP_STATUS } from "../constants";
import { logger } from "../config";


export interface RequestWithPayment extends Request {
  paymentData?: {
    holder_did: string;
    item_ids: string[];
  };
}

/**
 * Validate payment configuration middleware
 * Checks if DOKU credentials are configured
 */
export const validatePaymentConfig = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    if (!process.env.DOKU_CLIENT_ID || !process.env.DOKU_SECRET_KEY) {
      logger.error("DOKU payment credentials not configured");
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Payment gateway not configured properly",
      });
      return;
    }

    logger.debug("Payment configuration validated successfully");
    next();
  } catch (error) {
    logger.error("Error in validatePaymentConfig middleware:", error);
    console.error("Full error:", error); // Debug error detail
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Internal server error occurred",
    });
  }
};

/**
 * Validate payment request data middleware
 * Validates required fields and data types for payment creation
 * NOTE: This middleware is deprecated. Use paymentValidators from validators instead.
 */
export const validatePaymentRequest = (
  req: RequestWithPayment,
  res: Response,
  next: NextFunction
): void => {
  try {
    const { holder_did, item_ids } = req.body;

    if (!holder_did || !item_ids) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: "Payment data is incomplete. holder_did and item_ids are required",
      });
      return;
    }

    if (typeof holder_did !== "string") {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: "invalid holder_did format",
      });
      return;
    }

    if (!Array.isArray(item_ids) || item_ids.length === 0) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
      success: false,
      message: "Item IDs must be a non-empty array",
      });
      return;
    }

    if (!item_ids.every(id => typeof id === "string" && id.trim().length > 0)) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
      success: false,
      message: "All item IDs must be valid non-empty strings",
      });
      return;
    }


    req.paymentData = {
      holder_did: holder_did.trim(),
      item_ids: item_ids.map((id: string) => id.trim()),
    };

    logger.debug("Payment request validated successfully", req.paymentData);
    next();
  } catch (error) {
    logger.error("Error in validatePaymentRequest middleware", error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Internal server error occurred",
    });
  }
};

/**
 * Validate minimum amount middleware
 * Checks if payment amount meets minimum requirement
 */
export const validateMinimumAmount = (minimumAmount: number = 1000) => {
  return (req: RequestWithPayment, res: Response, next: NextFunction): void => {
    if (!req.body) {
      logger.error("req.body is undefined in validateMinimumAmount");
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: "Request body is missing",
      });
      return;
    }

    const { amount } = req.body;
    logger.debug(`Validating minimum amount: ${amount}, minimum required: ${minimumAmount}`);

    if (amount && amount < minimumAmount) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: `Minimum amount is Rp ${minimumAmount.toLocaleString("id-ID")}`,
      });
      return;
    }

    next();
  };
};

/**
 * Validate maximum amount middleware
 * Checks if payment amount doesn't exceed maximum limit
 */
export const validateMaximumAmount = (maximumAmount: number = 100000000) => {
  return (req: RequestWithPayment, res: Response, next: NextFunction): void => {
    if (!req.body) {
      logger.error("req.body is undefined in validateMaximumAmount");
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: "Request body is missing",
      });
      return;
    }

    const { amount } = req.body;

    if (amount && amount > maximumAmount) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: `Maximum amount is Rp ${maximumAmount.toLocaleString("id-ID")}`,
      });
      return;
    }

    next();
  };
};
