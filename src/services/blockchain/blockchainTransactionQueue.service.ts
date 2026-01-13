import Bull, { Queue, Job } from 'bull';
import { prisma } from '../../config/database';
import logger from '../../config/logger';
import { BlockchainTransactionType } from '@prisma/client';

/**
 * Blockchain Transaction Queue Service
 * Manages async blockchain transaction processing
 */
class BlockchainTransactionQueueService {
  private queue: Queue;

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
}

// Export singleton instance
const blockchainTransactionQueueService = new BlockchainTransactionQueueService();
export default blockchainTransactionQueueService;
