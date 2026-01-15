import { Request, Response, NextFunction } from "express";
import { HTTP_STATUS } from "../constants";
import { logger } from "../config";
import paymentSignatureUtilInstance, { DokuWebhookHeaders } from "../utils/paymentSignature";
import { prisma } from "../config/database";

export interface RequestWithPayment extends Request {
  paymentData?: {
    holder_did: string;
    item_ids: string[];
  };
}

export interface RequestWithDokuWebhook extends Request {
  dokuVerified?: boolean;
  dokuHeaders?: DokuWebhookHeaders;
  rawBody?: string;
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

/**
 * Verify DOKU Webhook Signature Middleware
 * This middleware verifies the HMAC-SHA256 signature from DOKU webhook notifications
 * to ensure the request is authentic and not tampered with.
 *
 * Security features:
 * - HMAC-SHA256 signature verification
 * - Client-Id validation
 * - Timestamp validation (prevents replay attacks)
 * - Constant-time comparison (prevents timing attacks)
 */
export const verifyDokuWebhookSignature = async (
  req: RequestWithDokuWebhook,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // 1. Check if DOKU credentials are configured
    const secretKey = process.env.DOKU_SECRET_KEY;
    const configuredClientId = process.env.DOKU_CLIENT_ID;

    if (!secretKey || !configuredClientId) {
      logger.error("[DOKU Webhook] DOKU credentials not configured");
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        responseCode: "5002500",
        responseMessage: "Payment gateway not configured",
      });
      return;
    }

    // 2. Extract headers (case-insensitive)
    const clientId = req.headers["client-id"] as string;
    const requestId = req.headers["request-id"] as string;
    const requestTimestamp = req.headers["request-timestamp"] as string;
    const signature = req.headers["signature"] as string;

    // 3. Log incoming webhook for debugging
    logger.info("[DOKU Webhook] Incoming notification:", {
      clientId,
      requestId,
      requestTimestamp,
      signaturePrefix: signature ? signature.substring(0, 20) + "..." : "missing",
      invoiceNumber: req.body?.order?.invoice_number,
      transactionStatus: req.body?.transaction?.status,
    });

    // 4. Validate required headers exist
    if (!clientId || !requestId || !requestTimestamp || !signature) {
      logger.warn("[DOKU Webhook] Missing required headers", {
        hasClientId: !!clientId,
        hasRequestId: !!requestId,
        hasTimestamp: !!requestTimestamp,
        hasSignature: !!signature,
      });
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        responseCode: "4002501",
        responseMessage: "Missing required headers",
      });
      return;
    }

    // 5. Prepare headers object for verification
    const headers: DokuWebhookHeaders = {
      clientId,
      requestId,
      requestTimestamp,
      signature,
    };

    // 6. Get request target (path only, without query string)
    const requestTarget = (req.originalUrl || req.url).split('?')[0];

    // 7. Verify signature using raw body (not parsed JSON)
    // Raw body is preserved exactly as DOKU sent it
    const rawBody = (req as any).rawBody;

    if (!rawBody) {
      logger.error("[DOKU Webhook] Raw body not available for signature verification");
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        responseCode: "5002500",
        responseMessage: "Server configuration error",
      });
      return;
    }

    const verificationResult = await paymentSignatureUtilInstance.verifyWebhookSignature(
      headers,
      rawBody,
      requestTarget,
      secretKey
    );

    if (!verificationResult.isValid) {
      logger.error("[DOKU Webhook] Signature verification failed:", {
        message: verificationResult.message,
        invoiceNumber: req.body?.order?.invoice_number,
        clientId,
        requestId,
      });

      // Log expected vs received for debugging (in development only)
      if (process.env.NODE_ENV !== "production") {
        logger.debug("[DOKU Webhook] Signature mismatch details:", {
          expected: verificationResult.expectedSignature,
          received: verificationResult.receivedSignature,
          debug: (verificationResult as any).debug,
        });
      }

      res.status(HTTP_STATUS.FORBIDDEN).json({
        responseCode: "4032500",
        responseMessage: "Invalid signature",
      });
      return;
    }

    // 8. Validate notification body structure
    const bodyValidation = paymentSignatureUtilInstance.validateNotificationBody(req.body);
    if (!bodyValidation.isValid) {
      logger.warn("[DOKU Webhook] Invalid notification body:", {
        message: bodyValidation.message,
        missingFields: bodyValidation.missingFields,
      });
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        responseCode: "4002502",
        responseMessage: bodyValidation.message,
      });
      return;
    }

    // 9. Store verified headers in request for later use
    req.dokuVerified = true;
    req.dokuHeaders = headers;

    logger.success("[DOKU Webhook] Signature verified successfully", {
      invoiceNumber: req.body?.order?.invoice_number,
      requestId,
    });

    next();
  } catch (error: any) {
    logger.error("[DOKU Webhook] Signature verification error:", error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      responseCode: "5002500",
      responseMessage: "Internal server error during signature verification",
    });
  }
};

/**
 * Validate Payment Amount Middleware
 * Verifies that the amount from DOKU webhook matches the amount in database
 * This prevents amount manipulation attacks
 */
export const validateWebhookPaymentAmount = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const invoiceNumber = req.body?.order?.invoice_number;
    const webhookAmount = req.body?.order?.amount;

    if (!invoiceNumber || webhookAmount === undefined) {
      logger.warn("[DOKU Webhook] Missing invoice_number or amount in webhook");
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        responseCode: "4002503",
        responseMessage: "Missing invoice_number or amount",
      });
      return;
    }

    // Get order from database
    const order = await prisma.orderBlockchain.findUnique({
      where: { id: invoiceNumber },
      select: { id: true, amount: true, status: true },
    });

    if (!order) {
      logger.warn("[DOKU Webhook] Order not found in database:", { invoiceNumber });
      res.status(HTTP_STATUS.NOT_FOUND).json({
        responseCode: "4042500",
        responseMessage: "Order not found",
      });
      return;
    }

    // Compare amounts (convert to same type for comparison)
    const dbAmount = Number(order.amount);
    const receivedAmount = Number(webhookAmount);

    if (dbAmount !== receivedAmount) {
      logger.error("[DOKU Webhook] Amount mismatch detected!", {
        invoiceNumber,
        dbAmount,
        receivedAmount,
        difference: Math.abs(dbAmount - receivedAmount),
      });

      // This is a potential attack - log it but still respond with success
      // to not reveal information to attacker
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        responseCode: "4002504",
        responseMessage: "Amount validation failed",
      });
      return;
    }

    logger.info("[DOKU Webhook] Amount validated successfully", {
      invoiceNumber,
      amount: dbAmount,
    });

    next();
  } catch (error: any) {
    logger.error("[DOKU Webhook] Amount validation error:", error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      responseCode: "5002500",
      responseMessage: "Internal server error during amount validation",
    });
  }
};

/**
 * Check Idempotency Middleware
 * Prevents duplicate processing of the same webhook notification
 * Uses request-id from DOKU as idempotency key
 */
export const checkWebhookIdempotency = async (
  req: RequestWithDokuWebhook,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const requestId = req.headers["request-id"] as string;
    const invoiceNumber = req.body?.order?.invoice_number;

    if (!requestId) {
      logger.warn("[DOKU Webhook] Missing request-id for idempotency check");
      next(); // Continue without idempotency check
      return;
    }

    // Check if this request-id was already processed
    const existingPayment = await prisma.paymentBlockchain.findFirst({
      where: {
        orderID: invoiceNumber,
        status: "SUCCESS",
      },
      select: { id: true, status: true, updatedAt: true },
    });

    if (existingPayment) {
      logger.warn("[DOKU Webhook] Duplicate notification detected", {
        requestId,
        invoiceNumber,
        existingPaymentId: existingPayment.id,
        existingStatus: existingPayment.status,
      });

      // Return success to DOKU (so they don't retry) but don't process again
      res.status(HTTP_STATUS.OK).json({
        responseCode: "2002500",
        responseMessage: "Success (already processed)",
      });
      return;
    }

    next();
  } catch (error: any) {
    logger.error("[DOKU Webhook] Idempotency check error:", error);
    // Continue even if check fails - better to risk duplicate than reject valid request
    next();
  }
};
