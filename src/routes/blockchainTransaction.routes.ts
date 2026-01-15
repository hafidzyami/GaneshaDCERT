import express, { Router } from "express";
import {
  getFailedTransactions,
  getPendingTransactions,
  getTransactionStatus,
  retryTransaction,
  retryAllFailed,
  getQueueStats,
  getFailedJobs,
  retryFailedJob,
  cleanFailedJobs,
} from "../controllers/blockchainTransaction.controller";
import { adminAuthMiddleware } from "../middlewares/adminAuth.middleware";
import { param } from "express-validator";

const router: Router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Blockchain Transactions
 *   description: Blockchain transaction management endpoints (Admin only)
 */

// All routes require admin authentication
router.use(adminAuthMiddleware);

/**
 * @swagger
 * /blockchain-transactions/stats:
 *   get:
 *     summary: Get queue statistics
 *     description: Get current queue statistics (waiting, active, completed, failed, delayed)
 *     tags:
 *       - Blockchain Transactions
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Queue statistics retrieved successfully
 */
router.get("/stats", getQueueStats);

/**
 * @swagger
 * /blockchain-transactions/failed:
 *   get:
 *     summary: Get failed transactions
 *     description: Get list of failed transactions from database
 *     tags:
 *       - Blockchain Transactions
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Maximum number of transactions to return
 *     responses:
 *       200:
 *         description: Failed transactions retrieved successfully
 */
router.get("/failed", getFailedTransactions);

/**
 * @swagger
 * /blockchain-transactions/pending:
 *   get:
 *     summary: Get pending transactions
 *     description: Get list of pending transactions from database
 *     tags:
 *       - Blockchain Transactions
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Maximum number of transactions to return
 *     responses:
 *       200:
 *         description: Pending transactions retrieved successfully
 */
router.get("/pending", getPendingTransactions);

/**
 * @swagger
 * /blockchain-transactions/jobs/failed:
 *   get:
 *     summary: Get failed jobs from queue
 *     description: Get list of failed jobs from Bull queue
 *     tags:
 *       - Blockchain Transactions
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Maximum number of jobs to return
 *     responses:
 *       200:
 *         description: Failed jobs retrieved successfully
 */
router.get("/jobs/failed", getFailedJobs);

/**
 * @swagger
 * /blockchain-transactions/jobs/clean:
 *   delete:
 *     summary: Clean old failed jobs
 *     description: Remove old failed jobs from queue
 *     tags:
 *       - Blockchain Transactions
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: hours
 *         schema:
 *           type: integer
 *           default: 24
 *         description: Delete jobs older than this many hours
 *     responses:
 *       200:
 *         description: Failed jobs cleaned successfully
 */
router.delete("/jobs/clean", cleanFailedJobs);

/**
 * @swagger
 * /blockchain-transactions/jobs/{jobId}/retry:
 *   post:
 *     summary: Retry a failed job
 *     description: Retry a specific failed job from Bull queue
 *     tags:
 *       - Blockchain Transactions
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *         description: The job ID to retry
 *     responses:
 *       200:
 *         description: Job retried successfully
 *       400:
 *         description: Failed to retry job
 */
router.post(
  "/jobs/:jobId/retry",
  [param("jobId").notEmpty().withMessage("Job ID is required")],
  retryFailedJob
);

/**
 * @swagger
 * /blockchain-transactions/{transactionId}:
 *   get:
 *     summary: Get transaction status
 *     description: Get status of a specific transaction by ID
 *     tags:
 *       - Blockchain Transactions
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: transactionId
 *         required: true
 *         schema:
 *           type: string
 *         description: The transaction ID
 *     responses:
 *       200:
 *         description: Transaction status retrieved successfully
 *       404:
 *         description: Transaction not found
 */
router.get(
  "/:transactionId",
  [param("transactionId").notEmpty().withMessage("Transaction ID is required")],
  getTransactionStatus
);

/**
 * @swagger
 * /blockchain-transactions/{transactionId}/retry:
 *   post:
 *     summary: Retry a failed transaction
 *     description: Retry a specific failed transaction by ID
 *     tags:
 *       - Blockchain Transactions
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: transactionId
 *         required: true
 *         schema:
 *           type: string
 *         description: The transaction ID to retry
 *     responses:
 *       200:
 *         description: Transaction queued for retry
 *       400:
 *         description: Failed to retry transaction
 */
router.post(
  "/:transactionId/retry",
  [param("transactionId").notEmpty().withMessage("Transaction ID is required")],
  retryTransaction
);

/**
 * @swagger
 * /blockchain-transactions/retry-all:
 *   post:
 *     summary: Retry all failed transactions
 *     description: Retry all failed transactions in the database
 *     tags:
 *       - Blockchain Transactions
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All failed transactions queued for retry
 */
router.post("/retry-all", retryAllFailed);

export default router;
