import Bull, { Queue, Job } from 'bull';
import { prisma } from '../../config/database';
import logger from '../../config/logger';
import { BlockchainTransactionType } from '@prisma/client';
import distributedLockService from '../distributedLock.service';

/**
 * Worker type for leader election
 */
const WORKER_TYPE = 'blockchain-queue-processor';

/**
 * Blockchain Transaction Queue Service
 * Manages async blockchain transaction processing
 * Supports multi-instance deployment with leader election
 */
class BlockchainTransactionQueueService {
  private queue: Queue;
  private isProcessing: boolean = false;
  private processorRegistered: boolean = false;

  constructor() {
    // Initialize Bull queue with Redis connection
    // Use REDIS_URL if available, otherwise fallback to host/port
    const redisUrl = process.env.REDIS_URL;

    if (redisUrl) {
      this.queue = new Bull('blockchain-transactions', redisUrl, {
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
          removeOnComplete: 100, // Keep last 100 completed jobs
          removeOnFail: 1000,    // Keep last 1000 failed jobs
        },
      });
    } else {
      this.queue = new Bull('blockchain-transactions', {
        redis: {
          host: process.env.REDIS_HOST || 'redis',
          port: Number(process.env.REDIS_PORT) || 6379,
          password: process.env.REDIS_PASSWORD || undefined,
        },
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
          removeOnComplete: 100, // Keep last 100 completed jobs
          removeOnFail: 1000,    // Keep last 1000 failed jobs
        },
      });
    }

    logger.info('[BlockchainQueue] Initialized with Redis connection');
  }

  /**
   * Queue CREATE_ITEM transaction
   */
  async queueCreateItem(params: {
    itemId: string;
    price: number;
    vcID: string;
    issuerDID: string;
    holderDID: string;
    vcHash: string;
    itemType: number;
  }): Promise<{ transaction_id: string; status: string }> {
    try {
      // Save to database dengan status PENDING
      const transaction = await prisma.blockchainTransaction.create({
        data: {
          id: params.itemId,
          type: BlockchainTransactionType.CREATE_ITEM,
          status: 'PENDING',
          payload: JSON.stringify(params),
        },
      });

      // Add to queue
      await this.queue.add('createItem', params, {
        jobId: params.itemId,
      });

      logger.info(`[BlockchainQueue] Queued CREATE_ITEM: ${params.itemId}`);

      return {
        transaction_id: params.itemId,
        status: 'PENDING',
      };
    } catch (error: any) {
      logger.error(`[BlockchainQueue] Failed to queue CREATE_ITEM:`, error);
      throw new Error(`Failed to queue transaction: ${error.message}`);
    }
  }

  /**
   * Queue CREATE_ORDER transaction
   */
  async queueCreateOrder(params: {
    orderId: string;
    holderDID: string;
    amount: number;
    currency: string;
    itemIds: string[];
  }): Promise<{ transaction_id: string; status: string }> {
    try {
      const transaction = await prisma.blockchainTransaction.create({
        data: {
          id: params.orderId,
          type: BlockchainTransactionType.CREATE_ORDER,
          status: 'PENDING',
          payload: JSON.stringify(params),
        },
      });

      await this.queue.add('createOrder', params, {
        jobId: params.orderId,
      });

      logger.info(`[BlockchainQueue] Queued CREATE_ORDER: ${params.orderId}`);

      return {
        transaction_id: params.orderId,
        status: 'PENDING',
      };
    } catch (error: any) {
      logger.error(`[BlockchainQueue] Failed to queue CREATE_ORDER:`, error);
      throw new Error(`Failed to queue transaction: ${error.message}`);
    }
  }

  /**
   * Queue CREATE_PAYMENT transaction
   */
  async queueCreatePayment(params: {
    paymentId: string;
    orderID: string;
    status: string;
    amount: number;
  }): Promise<{ transaction_id: string; status: string }> {
    try {
      const transaction = await prisma.blockchainTransaction.create({
        data: {
          id: params.paymentId,
          type: BlockchainTransactionType.CREATE_PAYMENT,
          status: 'PENDING',
          payload: JSON.stringify(params),
        },
      });

      await this.queue.add('createPayment', params, {
        jobId: params.paymentId,
      });

      logger.info(`[BlockchainQueue] Queued CREATE_PAYMENT: ${params.paymentId}`);

      return {
        transaction_id: params.paymentId,
        status: 'PENDING',
      };
    } catch (error: any) {
      logger.error(`[BlockchainQueue] Failed to queue CREATE_PAYMENT:`, error);
      throw new Error(`Failed to queue transaction: ${error.message}`);
    }
  }

  /**
   * Queue COMPLETE_PAYMENT transaction
   */
  async queueCompletePayment(params: {
    paymentId: string;
    orderId: string;
    method: string;
    successStatus: string;
  }): Promise<{ transaction_id: string; status: string }> {
    try {
      const transactionId = `complete-payment-${params.paymentId}`;

      const transaction = await prisma.blockchainTransaction.create({
        data: {
          id: transactionId,
          type: BlockchainTransactionType.COMPLETE_PAYMENT,
          status: 'PENDING',
          payload: JSON.stringify(params),
        },
      });

      await this.queue.add('completePayment', params, {
        jobId: transactionId,
      });

      logger.info(`[BlockchainQueue] Queued COMPLETE_PAYMENT: ${params.paymentId}`);

      return {
        transaction_id: transactionId,
        status: 'PENDING',
      };
    } catch (error: any) {
      logger.error(`[BlockchainQueue] Failed to queue COMPLETE_PAYMENT:`, error);
      throw new Error(`Failed to queue transaction: ${error.message}`);
    }
  }

  /**
   * Queue FAILED_PAYMENT transaction
   */
  async queueFailedPayment(params: {
    paymentId: string;
    orderId: string;
    method: string;
    failedStatus: string;
  }): Promise<{ transaction_id: string; status: string }> {
    try {
      const transactionId = `failed-payment-${params.paymentId}`;

      const transaction = await prisma.blockchainTransaction.create({
        data: {
          id: transactionId,
          type: BlockchainTransactionType.FAILED_PAYMENT,
          status: 'PENDING',
          payload: JSON.stringify(params),
        },
      });

      await this.queue.add('failedPayment', params, {
        jobId: transactionId,
      });

      logger.info(`[BlockchainQueue] Queued FAILED_PAYMENT: ${params.paymentId}`);

      return {
        transaction_id: transactionId,
        status: 'PENDING',
      };
    } catch (error: any) {
      logger.error(`[BlockchainQueue] Failed to queue FAILED_PAYMENT:`, error);
      throw new Error(`Failed to queue transaction: ${error.message}`);
    }
  }

  /**
   * Get transaction status
   */
  async getTransactionStatus(transactionId: string): Promise<any> {
    try {
      const transaction = await prisma.blockchainTransaction.findUnique({
        where: { id: transactionId },
      });

      if (!transaction) {
        throw new Error(`Transaction ${transactionId} not found`);
      }

      return {
        transaction_id: transaction.id,
        type: transaction.type,
        status: transaction.status,
        tx_hash: transaction.txHash,
        block_number: transaction.blockNumber?.toString(),
        error: transaction.error,
        retry_count: transaction.retryCount,
        created_at: transaction.createdAt,
        processed_at: transaction.processedAt,
        confirmed_at: transaction.confirmedAt,
        failed_at: transaction.failedAt,
      };
    } catch (error: any) {
      logger.error(`[BlockchainQueue] Error getting transaction status:`, error);
      throw error;
    }
  }

  /**
   * Get pending transactions
   */
  async getPendingTransactions(limit: number = 10): Promise<any[]> {
    try {
      const transactions = await prisma.blockchainTransaction.findMany({
        where: {
          status: 'PENDING',
        },
        orderBy: {
          createdAt: 'asc',
        },
        take: limit,
      });

      return transactions.map(tx => ({
        transaction_id: tx.id,
        type: tx.type,
        status: tx.status,
        created_at: tx.createdAt,
      }));
    } catch (error: any) {
      logger.error(`[BlockchainQueue] Error getting pending transactions:`, error);
      throw error;
    }
  }

  /**
   * Get queue stats
   */
  async getQueueStats(): Promise<any> {
    try {
      const [waiting, active, completed, failed, delayed] = await Promise.all([
        this.queue.getWaitingCount(),
        this.queue.getActiveCount(),
        this.queue.getCompletedCount(),
        this.queue.getFailedCount(),
        this.queue.getDelayedCount(),
      ]);

      return {
        waiting,
        active,
        completed,
        failed,
        delayed,
        total: waiting + active + completed + failed + delayed,
      };
    } catch (error: any) {
      logger.error(`[BlockchainQueue] Error getting queue stats:`, error);
      throw error;
    }
  }

  /**
   * Get queue instance (for worker)
   */
  getQueue(): Queue {
    return this.queue;
  }

  /**
   * Get failed transactions from database
   */
  async getFailedTransactions(limit: number = 50): Promise<any[]> {
    try {
      const transactions = await prisma.blockchainTransaction.findMany({
        where: {
          status: 'FAILED',
        },
        orderBy: {
          failedAt: 'desc',
        },
        take: limit,
      });

      return transactions.map(tx => ({
        transaction_id: tx.id,
        type: tx.type,
        status: tx.status,
        error: tx.error,
        retry_count: tx.retryCount,
        created_at: tx.createdAt,
        failed_at: tx.failedAt,
      }));
    } catch (error: any) {
      logger.error(`[BlockchainQueue] Error getting failed transactions:`, error);
      throw error;
    }
  }

  /**
   * Retry a single failed transaction by ID
   */
  async retryTransaction(transactionId: string): Promise<{ success: boolean; message: string }> {
    try {
      // Get transaction from database
      const transaction = await prisma.blockchainTransaction.findUnique({
        where: { id: transactionId },
      });

      if (!transaction) {
        return { success: false, message: `Transaction ${transactionId} not found` };
      }

      if (transaction.status !== 'FAILED') {
        return { success: false, message: `Transaction ${transactionId} is not in FAILED status (current: ${transaction.status})` };
      }

      // Parse payload
      const payload = JSON.parse(transaction.payload as string);

      // Determine job name based on transaction type
      let jobName: string;
      switch (transaction.type) {
        case 'CREATE_ITEM':
          jobName = 'createItem';
          break;
        case 'CREATE_ORDER':
          jobName = 'createOrder';
          break;
        case 'CREATE_PAYMENT':
          jobName = 'createPayment';
          break;
        case 'COMPLETE_PAYMENT':
          jobName = 'completePayment';
          break;
        case 'FAILED_PAYMENT':
          jobName = 'failedPayment';
          break;
        default:
          return { success: false, message: `Unknown transaction type: ${transaction.type}` };
      }

      // Update status to PENDING
      await prisma.blockchainTransaction.update({
        where: { id: transactionId },
        data: {
          status: 'PENDING',
          error: null,
          failedAt: null,
        },
      });

      // Add back to queue with new job ID to avoid conflicts
      const newJobId = `${transactionId}-retry-${Date.now()}`;
      await this.queue.add(jobName, { ...payload, originalTransactionId: transactionId }, {
        jobId: newJobId,
      });

      logger.info(`[BlockchainQueue] Retrying transaction: ${transactionId} (new job: ${newJobId})`);

      return { success: true, message: `Transaction ${transactionId} queued for retry` };
    } catch (error: any) {
      logger.error(`[BlockchainQueue] Error retrying transaction:`, error);
      return { success: false, message: `Failed to retry: ${error.message}` };
    }
  }

  /**
   * Retry all failed transactions
   */
  async retryAllFailed(): Promise<{ success: number; failed: number; errors: string[] }> {
    try {
      const failedTransactions = await prisma.blockchainTransaction.findMany({
        where: { status: 'FAILED' },
      });

      let success = 0;
      let failed = 0;
      const errors: string[] = [];

      for (const tx of failedTransactions) {
        const result = await this.retryTransaction(tx.id);
        if (result.success) {
          success++;
        } else {
          failed++;
          errors.push(`${tx.id}: ${result.message}`);
        }
      }

      logger.info(`[BlockchainQueue] Retry all failed: ${success} success, ${failed} failed`);

      return { success, failed, errors };
    } catch (error: any) {
      logger.error(`[BlockchainQueue] Error retrying all failed:`, error);
      throw error;
    }
  }

  /**
   * Get failed jobs from Bull queue
   */
  async getFailedJobs(limit: number = 50): Promise<Job[]> {
    return this.queue.getFailed(0, limit - 1);
  }

  /**
   * Retry failed job from Bull queue by job ID
   */
  async retryFailedJob(jobId: string): Promise<{ success: boolean; message: string }> {
    try {
      const job = await this.queue.getJob(jobId);

      if (!job) {
        return { success: false, message: `Job ${jobId} not found in queue` };
      }

      const state = await job.getState();
      if (state !== 'failed') {
        return { success: false, message: `Job ${jobId} is not failed (current state: ${state})` };
      }

      await job.retry();
      logger.info(`[BlockchainQueue] Retried failed job: ${jobId}`);

      return { success: true, message: `Job ${jobId} retried successfully` };
    } catch (error: any) {
      logger.error(`[BlockchainQueue] Error retrying job:`, error);
      return { success: false, message: `Failed to retry job: ${error.message}` };
    }
  }

  /**
   * Clean failed jobs from queue
   */
  async cleanFailedJobs(olderThanMs: number = 24 * 60 * 60 * 1000): Promise<number> {
    try {
      const cleaned = await this.queue.clean(olderThanMs, 'failed');
      logger.info(`[BlockchainQueue] Cleaned ${cleaned.length} failed jobs older than ${olderThanMs}ms`);
      return cleaned.length;
    } catch (error: any) {
      logger.error(`[BlockchainQueue] Error cleaning failed jobs:`, error);
      throw error;
    }
  }

  // ============================================
  // MULTI-INSTANCE SUPPORT (Leader Election)
  // ============================================

  /**
   * Attempt to become the leader for queue processing
   * Only the leader instance should process jobs
   *
   * @returns true if this instance is the leader
   */
  async electAsLeader(): Promise<boolean> {
    const isLeader = await distributedLockService.electLeader(WORKER_TYPE);

    if (isLeader) {
      logger.info(`[BlockchainQueue] This instance is the leader for queue processing`);
    } else {
      logger.info(`[BlockchainQueue] Another instance is the leader, this instance will standby`);
    }

    return isLeader;
  }

  /**
   * Check if this instance is currently the leader
   */
  async isLeader(): Promise<boolean> {
    return distributedLockService.isLeader(WORKER_TYPE);
  }

  /**
   * Get leader information
   */
  async getLeaderInfo(): Promise<{
    isLeader: boolean;
    leaderId: string;
    lastHeartbeat: number;
  } | null> {
    return distributedLockService.getLeaderInfo(WORKER_TYPE);
  }

  /**
   * Resign from leadership (for graceful shutdown)
   */
  async resignLeadership(): Promise<void> {
    await distributedLockService.resignLeadership(WORKER_TYPE);
    this.isProcessing = false;
    logger.info(`[BlockchainQueue] Resigned from leadership`);
  }

  /**
   * Start queue processing with leader election
   * Only processes if this instance is the leader
   *
   * @param processor - Job processor function
   */
  async startProcessingAsLeader(
    processor: (job: Job) => Promise<void>
  ): Promise<void> {
    // Try to become leader
    const isLeader = await this.electAsLeader();

    if (!isLeader) {
      // Start a periodic check to become leader if current leader fails
      this.startLeadershipMonitor(processor);
      return;
    }

    // Register processor if not already registered
    if (!this.processorRegistered) {
      await this.registerProcessor(processor);
    }

    this.isProcessing = true;
    logger.info(`[BlockchainQueue] Started processing as leader`);
  }

  /**
   * Register job processor with distributed lock protection
   */
  private async registerProcessor(processor: (job: Job) => Promise<void>): Promise<void> {
    this.queue.process(async (job: Job) => {
      // Double-check we're still the leader before processing
      const stillLeader = await this.isLeader();
      if (!stillLeader) {
        logger.warn(`[BlockchainQueue] No longer leader, skipping job: ${job.id}`);
        throw new Error('Instance is no longer the leader');
      }

      // Acquire lock for this specific transaction
      const lock = await distributedLockService.lockBlockchainTransaction(
        job.id?.toString() || job.data.itemId || job.data.orderId || job.data.paymentId
      );

      if (!lock) {
        logger.warn(`[BlockchainQueue] Could not acquire lock for job: ${job.id}`);
        throw new Error('Could not acquire transaction lock');
      }

      try {
        await processor(job);
      } finally {
        await distributedLockService.releaseLock(lock);
      }
    });

    this.processorRegistered = true;
    logger.info(`[BlockchainQueue] Processor registered with distributed lock protection`);
  }

  /**
   * Monitor leadership and take over if leader fails
   */
  private startLeadershipMonitor(processor: (job: Job) => Promise<void>): void {
    const checkInterval = 15000; // Check every 15 seconds

    const monitor = setInterval(async () => {
      try {
        const isLeader = await this.electAsLeader();

        if (isLeader && !this.isProcessing) {
          // We became the leader, start processing
          if (!this.processorRegistered) {
            await this.registerProcessor(processor);
          }
          this.isProcessing = true;
          logger.info(`[BlockchainQueue] Took over as leader, starting processing`);
        }
      } catch (error) {
        logger.error(`[BlockchainQueue] Error in leadership monitor:`, error);
      }
    }, checkInterval);

    // Store interval for cleanup
    (this as any)._leadershipMonitor = monitor;
    logger.info(`[BlockchainQueue] Leadership monitor started (checking every ${checkInterval}ms)`);
  }

  /**
   * Stop leadership monitor
   */
  stopLeadershipMonitor(): void {
    if ((this as any)._leadershipMonitor) {
      clearInterval((this as any)._leadershipMonitor);
      delete (this as any)._leadershipMonitor;
      logger.info(`[BlockchainQueue] Leadership monitor stopped`);
    }
  }

  /**
   * Get multi-instance status
   */
  async getMultiInstanceStatus(): Promise<{
    instanceId: string;
    isLeader: boolean;
    isProcessing: boolean;
    leaderInfo: any;
    queueStats: any;
  }> {
    const [isLeader, leaderInfo, queueStats] = await Promise.all([
      this.isLeader(),
      this.getLeaderInfo(),
      this.getQueueStats(),
    ]);

    return {
      instanceId: distributedLockService.getInstanceId(),
      isLeader,
      isProcessing: this.isProcessing,
      leaderInfo,
      queueStats,
    };
  }

  /**
   * Graceful shutdown
   * Resigns leadership and stops processing
   */
  async shutdown(): Promise<void> {
    logger.info(`[BlockchainQueue] Initiating graceful shutdown...`);

    // Stop leadership monitor
    this.stopLeadershipMonitor();

    // Resign leadership
    await this.resignLeadership();

    // Close queue
    await this.queue.close();

    logger.info(`[BlockchainQueue] Shutdown complete`);
  }
}

// Export singleton instance
const blockchainTransactionQueueService = new BlockchainTransactionQueueService();
export default blockchainTransactionQueueService;
