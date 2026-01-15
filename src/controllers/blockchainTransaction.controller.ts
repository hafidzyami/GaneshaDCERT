import { Request, Response } from "express";
import { validationResult } from "express-validator";
import { ValidationError } from "../utils";
import { asyncHandler } from "../middlewares";
import { ResponseHelper } from "../utils/helpers";
import blockchainTransactionQueueService from "../services/blockchain/blockchainTransactionQueue.service";

/**
 * Get failed transactions from database
 */
export const getFailedTransactions = asyncHandler(
  async (req: Request, res: Response) => {
    const limit = parseInt(req.query.limit as string) || 50;

    const result = await blockchainTransactionQueueService.getFailedTransactions(limit);

    return ResponseHelper.success(
      res,
      {
        count: result.length,
        transactions: result,
      },
      "Failed transactions retrieved successfully"
    );
  }
);

/**
 * Get pending transactions from database
 */
export const getPendingTransactions = asyncHandler(
  async (req: Request, res: Response) => {
    const limit = parseInt(req.query.limit as string) || 50;

    const result = await blockchainTransactionQueueService.getPendingTransactions(limit);

    return ResponseHelper.success(
      res,
      {
        count: result.length,
        transactions: result,
      },
      "Pending transactions retrieved successfully"
    );
  }
);

/**
 * Get transaction status by ID
 */
export const getTransactionStatus = asyncHandler(
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError("Validation error", errors.array());
    }

    const { transactionId } = req.params;

    const result = await blockchainTransactionQueueService.getTransactionStatus(transactionId);

    return ResponseHelper.success(
      res,
      result,
      "Transaction status retrieved successfully"
    );
  }
);

/**
 * Retry a single failed transaction by ID
 */
export const retryTransaction = asyncHandler(
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError("Validation error", errors.array());
    }

    const { transactionId } = req.params;

    const result = await blockchainTransactionQueueService.retryTransaction(transactionId);

    if (!result.success) {
      return ResponseHelper.error(res, 400, result.message);
    }

    return ResponseHelper.success(
      res,
      result,
      result.message
    );
  }
);

/**
 * Retry all failed transactions
 */
export const retryAllFailed = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await blockchainTransactionQueueService.retryAllFailed();

    return ResponseHelper.success(
      res,
      result,
      `Retry completed: ${result.success} success, ${result.failed} failed`
    );
  }
);

/**
 * Get queue statistics
 */
export const getQueueStats = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await blockchainTransactionQueueService.getQueueStats();

    return ResponseHelper.success(
      res,
      result,
      "Queue statistics retrieved successfully"
    );
  }
);

/**
 * Get failed jobs from Bull queue
 */
export const getFailedJobs = asyncHandler(
  async (req: Request, res: Response) => {
    const limit = parseInt(req.query.limit as string) || 50;

    const jobs = await blockchainTransactionQueueService.getFailedJobs(limit);

    const result = jobs.map(job => ({
      id: job.id,
      name: job.name,
      data: job.data,
      failedReason: job.failedReason,
      attemptsMade: job.attemptsMade,
      timestamp: job.timestamp,
      processedOn: job.processedOn,
      finishedOn: job.finishedOn,
    }));

    return ResponseHelper.success(
      res,
      {
        count: result.length,
        jobs: result,
      },
      "Failed jobs retrieved successfully"
    );
  }
);

/**
 * Retry a failed job from Bull queue by job ID
 */
export const retryFailedJob = asyncHandler(
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError("Validation error", errors.array());
    }

    const { jobId } = req.params;

    const result = await blockchainTransactionQueueService.retryFailedJob(jobId);

    if (!result.success) {
      return ResponseHelper.error(res, 400, result.message);
    }

    return ResponseHelper.success(
      res,
      result,
      result.message
    );
  }
);

/**
 * Clean old failed jobs from queue
 */
export const cleanFailedJobs = asyncHandler(
  async (req: Request, res: Response) => {
    const olderThanHours = parseInt(req.query.hours as string) || 24;
    const olderThanMs = olderThanHours * 60 * 60 * 1000;

    const cleaned = await blockchainTransactionQueueService.cleanFailedJobs(olderThanMs);

    return ResponseHelper.success(
      res,
      {
        cleaned,
        olderThanHours,
      },
      `Cleaned ${cleaned} failed jobs older than ${olderThanHours} hours`
    );
  }
);
