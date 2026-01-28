import { Request, Response } from "express";
import { validationResult } from "express-validator";
import { ValidationError } from "../utils";
import { asyncHandler } from "../middlewares";
import { ResponseHelper } from "../utils/helpers";
import blockchainTransactionQueueService from "../services/blockchain/blockchainTransactionQueue.service";
import paymentBlockchainService from "../services/blockchain/paymentBlockchain.service";
import { prisma } from "../config/database";
import logger from "../config/logger";

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

/**
 * Helper: Check if a string is a bytes32 hash
 */
function isBytes32Hash(value: string): boolean {
  if (!value) return false;
  return /^0x[a-fA-F0-9]{64}$/.test(value);
}

/**
 * Detect corrupted data (bytes32 hashes) in blockchain tables
 */
export const detectCorruptedData = asyncHandler(
  async (req: Request, res: Response) => {
    logger.info("[RepairData] Detecting corrupted data in blockchain tables...");

    // Find items with bytes32 hash data
    const allItems = await prisma.itemBlockchain.findMany();
    const corruptedItems = allItems.filter(item =>
      isBytes32Hash(item.vcID) ||
      isBytes32Hash(item.issuerDID) ||
      isBytes32Hash(item.holderDID)
    );

    // Find orders with bytes32 hash data
    const allOrders = await prisma.orderBlockchain.findMany();
    const corruptedOrders = allOrders.filter(order =>
      isBytes32Hash(order.holderDID)
    );

    // Find payments with bytes32 hash data
    const allPayments = await prisma.paymentBlockchain.findMany();
    const corruptedPayments = allPayments.filter(payment =>
      isBytes32Hash(payment.orderID)
    );

    // Find items where isPaid doesn't match blockchain
    const itemsToCheck: any[] = [];
    for (const item of allItems.slice(0, 50)) { // Limit to 50 for performance
      try {
        const blockchainItem = await paymentBlockchainService.getItem(item.id);
        if (blockchainItem.isPaid !== item.isPaid) {
          itemsToCheck.push({
            id: item.id,
            dbIsPaid: item.isPaid,
            blockchainIsPaid: blockchainItem.isPaid,
          });
        }
      } catch (error: any) {
        // Item might not exist on blockchain
        logger.debug(`[RepairData] Item ${item.id} not found on blockchain`);
      }
    }

    return ResponseHelper.success(
      res,
      {
        corruptedItems: {
          count: corruptedItems.length,
          items: corruptedItems.map(i => ({
            id: i.id,
            vcID: i.vcID,
            issuerDID: i.issuerDID,
            holderDID: i.holderDID,
            isPaid: i.isPaid,
          })),
        },
        corruptedOrders: {
          count: corruptedOrders.length,
          orders: corruptedOrders.map(o => ({
            id: o.id,
            holderDID: o.holderDID,
            status: o.status,
          })),
        },
        corruptedPayments: {
          count: corruptedPayments.length,
          payments: corruptedPayments.map(p => ({
            id: p.id,
            orderID: p.orderID,
            status: p.status,
          })),
        },
        isPaidMismatch: {
          count: itemsToCheck.length,
          items: itemsToCheck,
        },
      },
      "Corrupted data detection completed"
    );
  }
);

/**
 * Repair ItemBlockchain isPaid status from blockchain
 * This syncs isPaid status from blockchain to database for items where it's mismatched
 */
export const repairItemsPaidStatus = asyncHandler(
  async (req: Request, res: Response) => {
    logger.info("[RepairData] Repairing ItemBlockchain isPaid status from blockchain...");

    const allItems = await prisma.itemBlockchain.findMany({
      where: { isPaid: false },
    });

    const repaired: any[] = [];
    const errors: any[] = [];

    for (const item of allItems) {
      try {
        // Check if item exists on blockchain
        const exists = await paymentBlockchainService.itemExists(item.id);
        if (!exists) {
          logger.debug(`[RepairData] Item ${item.id} not found on blockchain, skipping`);
          continue;
        }

        const blockchainItem = await paymentBlockchainService.getItem(item.id);

        if (blockchainItem.isPaid && !item.isPaid) {
          // Update database to match blockchain
          await prisma.itemBlockchain.update({
            where: { id: item.id },
            data: {
              isPaid: true,
              updatedAt: new Date(),
            },
          });

          repaired.push({
            id: item.id,
            vcID: item.vcID,
            oldIsPaid: false,
            newIsPaid: true,
          });

          logger.success(`[RepairData] ✅ Repaired isPaid for item: ${item.id}`);
        }
      } catch (error: any) {
        errors.push({
          id: item.id,
          error: error.message,
        });
        logger.error(`[RepairData] ❌ Error repairing item ${item.id}:`, error.message);
      }
    }

    return ResponseHelper.success(
      res,
      {
        totalChecked: allItems.length,
        repaired: {
          count: repaired.length,
          items: repaired,
        },
        errors: {
          count: errors.length,
          items: errors,
        },
      },
      `Repair completed: ${repaired.length} items fixed, ${errors.length} errors`
    );
  }
);

/**
 * Repair corrupted data by re-fetching from Order table
 * Uses the original VCs_id from Order table to fix ItemBlockchain records
 */
export const repairCorruptedData = asyncHandler(
  async (req: Request, res: Response) => {
    logger.info("[RepairData] Repairing corrupted data using Order table as source of truth...");

    // Get all orders from Order table (has original data)
    const orders = await prisma.order.findMany({
      select: {
        id: true,
        holder_did: true,
        issuer_did: true,
        VCs_id: true,
        request_type: true,
      },
    });

    const repairedItems: any[] = [];
    const repairedOrders: any[] = [];
    const errors: any[] = [];

    for (const order of orders) {
      try {
        // Repair OrderBlockchain if it has corrupted holderDID
        const orderBlockchain = await prisma.orderBlockchain.findUnique({
          where: { id: order.id },
        });

        if (orderBlockchain && isBytes32Hash(orderBlockchain.holderDID)) {
          await prisma.orderBlockchain.update({
            where: { id: order.id },
            data: {
              holderDID: order.holder_did,
              updatedAt: new Date(),
            },
          });

          repairedOrders.push({
            id: order.id,
            oldHolderDID: orderBlockchain.holderDID.substring(0, 20) + "...",
            newHolderDID: order.holder_did,
          });

          logger.success(`[RepairData] ✅ Repaired OrderBlockchain: ${order.id}`);
        }

        // Repair ItemBlockchain records for this order
        if (order.VCs_id && order.VCs_id.length > 0) {
          for (const vcId of order.VCs_id) {
            const itemBlockchain = await prisma.itemBlockchain.findFirst({
              where: {
                OR: [
                  { id: vcId },
                  { vcID: vcId },
                ],
              },
            });

            if (itemBlockchain) {
              const needsRepair =
                isBytes32Hash(itemBlockchain.issuerDID) ||
                isBytes32Hash(itemBlockchain.holderDID) ||
                isBytes32Hash(itemBlockchain.vcID);

              if (needsRepair) {
                await prisma.itemBlockchain.update({
                  where: { id: itemBlockchain.id },
                  data: {
                    issuerDID: order.issuer_did,
                    holderDID: order.holder_did,
                    vcID: vcId,
                    updatedAt: new Date(),
                  },
                });

                repairedItems.push({
                  id: itemBlockchain.id,
                  vcID: vcId,
                  issuerDID: order.issuer_did,
                  holderDID: order.holder_did,
                });

                logger.success(`[RepairData] ✅ Repaired ItemBlockchain: ${itemBlockchain.id}`);
              }
            }
          }
        }
      } catch (error: any) {
        errors.push({
          orderId: order.id,
          error: error.message,
        });
        logger.error(`[RepairData] ❌ Error repairing order ${order.id}:`, error.message);
      }
    }

    return ResponseHelper.success(
      res,
      {
        ordersChecked: orders.length,
        repairedOrders: {
          count: repairedOrders.length,
          orders: repairedOrders,
        },
        repairedItems: {
          count: repairedItems.length,
          items: repairedItems,
        },
        errors: {
          count: errors.length,
          items: errors,
        },
      },
      `Repair completed: ${repairedOrders.length} orders, ${repairedItems.length} items fixed, ${errors.length} errors`
    );
  }
);
