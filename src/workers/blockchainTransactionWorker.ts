import { Job } from 'bull';
import { prisma } from '../config/database';
import logger from '../config/logger';
import blockchainTransactionQueueService from '../services/blockchain/blockchainTransactionQueue.service';
import paymentBlockchainService from '../services/blockchain/paymentBlockchain.service';
import PaymentEventProcessor from '../services/processors/paymentEventProcessor';
import { uint248ToNumber } from '../utils/blockchain.helper';

/**
 * Blockchain Transaction Worker
 * Processes queued blockchain transactions in background
 */
class BlockchainTransactionWorker {
  private queue: any;
  private processor: PaymentEventProcessor;

  constructor() {
    this.queue = blockchainTransactionQueueService.getQueue();
    this.processor = new PaymentEventProcessor(prisma);
    this.setupProcessors();
  }

  /**
   * Setup queue processors for different transaction types
   */
  private setupProcessors(): void {
    // Process CREATE_ITEM transactions
    this.queue.process('createItem', async (job: Job) => {
      return this.processCreateItem(job);
    });

    // Process CREATE_ORDER transactions
    this.queue.process('createOrder', async (job: Job) => {
      return this.processCreateOrder(job);
    });

    // Process CREATE_PAYMENT transactions
    this.queue.process('createPayment', async (job: Job) => {
      return this.processCreatePayment(job);
    });

    // Process COMPLETE_PAYMENT transactions
    this.queue.process('completePayment', async (job: Job) => {
      return this.processCompletePayment(job);
    });

    // Process FAILED_PAYMENT transactions
    this.queue.process('failedPayment', async (job: Job) => {
      return this.processFailedPayment(job);
    });

    // Setup event listeners
    this.setupEventListeners();

    logger.success('[BlockchainWorker] All processors initialized');
  }

  /**
   * Process CREATE_ITEM transaction
   */
  private async processCreateItem(job: Job): Promise<any> {
    const { itemId, price, vcID, issuerDID, holderDID, vcHash, itemType } = job.data;

    logger.info(`[BlockchainWorker] Processing CREATE_ITEM: ${itemId}`);

    try {
      // Update status to PROCESSING
      await prisma.blockchainTransaction.update({
        where: { id: itemId },
        data: {
          status: 'PROCESSING',
          processedAt: new Date(),
          retryCount: job.attemptsMade,
        },
      });

      let receipt;
      let isAlreadyExist = false;

      try {
        // Execute blockchain transaction
        receipt = await paymentBlockchainService.createItem(
          itemId,
          price,
          vcID,
          issuerDID,
          holderDID,
          vcHash,
          itemType
        );
      } catch (error: any) {
        // Check if item already exists on blockchain
        if (error.message && error.message.includes('Item already exist')) {
          logger.warn(`[BlockchainWorker] ⚠️  Item already exists on blockchain: ${itemId}, syncing from blockchain...`);
          isAlreadyExist = true;

          // Get existing item from blockchain (for status/isPaid info)
          const existingItem = await paymentBlockchainService.getItem(itemId);

          // Create a pseudo-receipt for existing item
          receipt = {
            hash: 'already-exists',
            blockNumber: 0, // We don't know the original block number
          };

          // Sync to database using ORIGINAL job data for strings
          // (blockchain returns bytes32 hashes for DIDs which can't be decoded)
          await this.processor.handleItemCreated({
            id: itemId,
            vcID: vcID, // Use original from job.data
            issuerDID: issuerDID, // Use original from job.data
            holderDID: holderDID, // Use original from job.data
            vcHash: vcHash, // Use original from job.data
            price: Number(existingItem.price),
            itemType: Number(existingItem.itemType),
            timestamp: Date.now() / 1000,
            blockNumber: 0,
            transactionHash: 'already-exists',
          });

          logger.success(`[BlockchainWorker] ✅ Item synced from blockchain: ${itemId}`);
        } else {
          // Other errors - rethrow
          throw error;
        }
      }

      // Update status to CONFIRMED
      await prisma.blockchainTransaction.update({
        where: { id: itemId },
        data: {
          status: 'CONFIRMED',
          txHash: receipt.hash,
          blockNumber: receipt.blockNumber,
          confirmedAt: new Date(),
          error: isAlreadyExist ? 'Item already existed on blockchain, synced to database' : null,
        },
      });

      if (!isAlreadyExist) {
        logger.success(`[BlockchainWorker] ✅ CREATE_ITEM confirmed: ${itemId} (tx: ${receipt.hash})`);

        // Immediately process the event to update database
        logger.info(`[BlockchainWorker] Processing ItemCreated event for ${itemId}...`);
        await this.processor.handleItemCreated({
          id: itemId,
          vcID: vcID,
          issuerDID: issuerDID,
          holderDID: holderDID,
          vcHash: vcHash,
          price: price,
          itemType: itemType,
          timestamp: Date.now() / 1000,
          blockNumber: receipt.blockNumber,
          transactionHash: receipt.hash,
        });
        logger.success(`[BlockchainWorker] ✅ ItemCreated event processed for ${itemId}`);
      }

      return {
        success: true,
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber,
      };
    } catch (error: any) {
      logger.error(`[BlockchainWorker] ❌ CREATE_ITEM failed: ${itemId}`, error);

      // Update status to FAILED
      await prisma.blockchainTransaction.update({
        where: { id: itemId },
        data: {
          status: 'FAILED',
          error: error.message,
          failedAt: new Date(),
          retryCount: job.attemptsMade,
        },
      });

      throw error; // Bull will retry automatically
    }
  }

  /**
   * Process CREATE_ORDER transaction
   */
  private async processCreateOrder(job: Job): Promise<any> {
    const { orderId, holderDID, amount, currency, itemIds } = job.data;

    logger.info(`[BlockchainWorker] Processing CREATE_ORDER: ${orderId}`);

    try {
      await prisma.blockchainTransaction.update({
        where: { id: orderId },
        data: {
          status: 'PROCESSING',
          processedAt: new Date(),
          retryCount: job.attemptsMade,
        },
      });

      let receipt;
      let isAlreadyExist = false;

      try {
        receipt = await paymentBlockchainService.createOrder(
          orderId,
          holderDID,
          amount,
          currency,
          itemIds
        );
      } catch (error: any) {
        // Check if order already exists on blockchain
        if (error.message && error.message.includes('Order already exist')) {
          logger.warn(`[BlockchainWorker] ⚠️  Order already exists on blockchain: ${orderId}, syncing from blockchain...`);
          isAlreadyExist = true;

          // Get existing order from blockchain (for status info)
          const existingOrder = await paymentBlockchainService.getOrder(orderId);

          // Create a pseudo-receipt for existing order
          receipt = {
            hash: 'already-exists',
            blockNumber: 0,
          };

          // Sync to database using ORIGINAL job data for strings
          // (blockchain returns bytes32 hashes for DIDs which can't be decoded)
          await this.processor.handleOrderCreated({
            id: orderId,
            holderDID: holderDID, // Use original from job.data
            status: Number(existingOrder.status),
            amount: Number(existingOrder.amount),
            currency: currency, // Use original from job.data
            timestamp: Date.now() / 1000,
            blockNumber: 0,
            transactionHash: 'already-exists',
          });

          logger.success(`[BlockchainWorker] ✅ Order synced from blockchain: ${orderId}`);
        } else {
          throw error;
        }
      }

      await prisma.blockchainTransaction.update({
        where: { id: orderId },
        data: {
          status: 'CONFIRMED',
          txHash: receipt.hash,
          blockNumber: receipt.blockNumber,
          confirmedAt: new Date(),
          error: isAlreadyExist ? 'Order already existed on blockchain, synced to database' : null,
        },
      });

      if (!isAlreadyExist) {
        logger.success(`[BlockchainWorker] ✅ CREATE_ORDER confirmed: ${orderId} (tx: ${receipt.hash})`);

        // Immediately process the event to update database
        logger.info(`[BlockchainWorker] Processing OrderCreated event for ${orderId}...`);
        await this.processor.handleOrderCreated({
          id: orderId,
          holderDID: holderDID,
          status: 0, // PENDING status
          amount: amount,
          currency: currency,
          timestamp: Date.now() / 1000,
          blockNumber: receipt.blockNumber,
          transactionHash: receipt.hash,
        });
        logger.success(`[BlockchainWorker] ✅ OrderCreated event processed for ${orderId}`);
      }

      return {
        success: true,
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber,
      };
    } catch (error: any) {
      logger.error(`[BlockchainWorker] ❌ CREATE_ORDER failed: ${orderId}`, error);

      await prisma.blockchainTransaction.update({
        where: { id: orderId },
        data: {
          status: 'FAILED',
          error: error.message,
          failedAt: new Date(),
          retryCount: job.attemptsMade,
        },
      });

      throw error;
    }
  }

  /**
   * Process CREATE_PAYMENT transaction
   */
  private async processCreatePayment(job: Job): Promise<any> {
    const { paymentId, orderID, status, amount } = job.data;

    logger.info(`[BlockchainWorker] Processing CREATE_PAYMENT: ${paymentId}`);

    try {
      await prisma.blockchainTransaction.update({
        where: { id: paymentId },
        data: {
          status: 'PROCESSING',
          processedAt: new Date(),
          retryCount: job.attemptsMade,
        },
      });

      let receipt;
      let isAlreadyExist = false;

      try {
        receipt = await paymentBlockchainService.createPayment(
          paymentId,
          orderID,
          status,
          amount
        );
      } catch (error: any) {
        // Check if payment already exists on blockchain
        if (error.message && error.message.includes('Payment already exist')) {
          logger.warn(`[BlockchainWorker] ⚠️  Payment already exists on blockchain: ${paymentId}, syncing from blockchain...`);
          isAlreadyExist = true;

          // Get existing payment from blockchain (for amount info)
          const existingPayment = await paymentBlockchainService.getPayment(paymentId);

          // Create a pseudo-receipt for existing payment
          receipt = {
            hash: 'already-exists',
            blockNumber: 0,
          };

          // Sync to database using ORIGINAL job data for strings
          // method/status from blockchain may be decoded properly since they're short
          await this.processor.handlePaymentCreated({
            id: paymentId,
            orderID: orderID, // Use original from job.data
            method: existingPayment.method || '', // May be decoded bytes32
            status: status, // Use original from job.data
            amount: Number(existingPayment.amount),
            timestamp: Date.now() / 1000,
            blockNumber: 0,
            transactionHash: 'already-exists',
          });

          logger.success(`[BlockchainWorker] ✅ Payment synced from blockchain: ${paymentId}`);
        } else {
          throw error;
        }
      }

      await prisma.blockchainTransaction.update({
        where: { id: paymentId },
        data: {
          status: 'CONFIRMED',
          txHash: receipt.hash,
          blockNumber: receipt.blockNumber,
          confirmedAt: new Date(),
          error: isAlreadyExist ? 'Payment already existed on blockchain, synced to database' : null,
        },
      });

      if (!isAlreadyExist) {
        logger.success(`[BlockchainWorker] ✅ CREATE_PAYMENT confirmed: ${paymentId} (tx: ${receipt.hash})`);

        // Immediately process the event to update database
        logger.info(`[BlockchainWorker] Processing PaymentCreated event for ${paymentId}...`);
        await this.processor.handlePaymentCreated({
          id: paymentId,
          orderID: orderID,
          method: '', // Empty string - method is set later in completePayment
          status: status,
          amount: amount,
          timestamp: Date.now() / 1000,
          blockNumber: receipt.blockNumber,
          transactionHash: receipt.hash,
        });
        logger.success(`[BlockchainWorker] ✅ PaymentCreated event processed for ${paymentId}`);
      }

      return {
        success: true,
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber,
      };
    } catch (error: any) {
      logger.error(`[BlockchainWorker] ❌ CREATE_PAYMENT failed: ${paymentId}`, error);

      await prisma.blockchainTransaction.update({
        where: { id: paymentId },
        data: {
          status: 'FAILED',
          error: error.message,
          failedAt: new Date(),
          retryCount: job.attemptsMade,
        },
      });

      throw error;
    }
  }

  /**
   * Process COMPLETE_PAYMENT transaction
   */
  private async processCompletePayment(job: Job): Promise<any> {
    const { paymentId, orderId, method, successStatus } = job.data;
    const transactionId = `complete-payment-${paymentId}`;

    logger.info(`[BlockchainWorker] Processing COMPLETE_PAYMENT: ${paymentId}`);

    try {
      await prisma.blockchainTransaction.update({
        where: { id: transactionId },
        data: {
          status: 'PROCESSING',
          processedAt: new Date(),
          retryCount: job.attemptsMade,
        },
      });

      let receipt;
      let isAlreadyCompleted = false;

      try {
        receipt = await paymentBlockchainService.completePayment(
          paymentId,
          orderId,
          method,
          successStatus
        );
      } catch (error: any) {
        // Check if order is already completed
        if (error.message && error.message.includes('Order is not pending payment')) {
          logger.warn(`[BlockchainWorker] ⚠️  Order already completed on blockchain: ${orderId}, syncing from blockchain...`);
          isAlreadyCompleted = true;

          // Get existing order and payment from blockchain (for status info)
          const existingOrder = await paymentBlockchainService.getOrder(orderId);
          const existingPayment = await paymentBlockchainService.getPayment(paymentId);

          // Create a pseudo-receipt for existing payment
          receipt = {
            hash: 'already-completed',
            blockNumber: 0,
          };

          // Sync all events to database using ORIGINAL job data for strings
          const timestamp = Date.now() / 1000;

          // 1. PaymentCompleted event
          logger.info(`[BlockchainWorker] Syncing PaymentCompleted event for ${paymentId}...`);
          await this.processor.handlePaymentCompleted({
            id: paymentId,
            orderID: orderId, // Use original from job.data
            method: method, // Use original from job.data
            amount: Number(existingPayment.amount),
            timestamp: timestamp,
            blockNumber: 0,
            transactionHash: 'already-completed',
          });

          // 2. PaymentStatusChanged event
          logger.info(`[BlockchainWorker] Syncing PaymentStatusChanged event for ${paymentId}...`);
          await this.processor.handlePaymentStatusChanged({
            id: paymentId,
            orderID: orderId, // Use original from job.data
            oldStatus: 'PENDING',
            newStatus: successStatus, // Use original from job.data
            timestamp: timestamp,
            blockNumber: 0,
            transactionHash: 'already-completed',
          });

          // 3. OrderStatusChanged event
          logger.info(`[BlockchainWorker] Syncing OrderStatusChanged event for ${orderId}...`);
          await this.processor.handleOrderStatusChanged({
            id: orderId,
            oldStatus: 0, // PENDING
            newStatus: Number(existingOrder.status),
            timestamp: timestamp,
            blockNumber: 0,
            transactionHash: 'already-completed',
          });

          // 4. ItemPaid events (for each item in order)
          // Get bytes32 item IDs from blockchain order, then match with database items
          logger.info(`[BlockchainWorker] Syncing ItemPaid events for order ${orderId}...`);

          const itemBytes32Array = existingOrder.items as string[];

          // Get all unpaid items from database and match by bytes32
          const allUnpaidItems = await prisma.itemBlockchain.findMany({
            where: { isPaid: false },
            select: { id: true, vcID: true }
          });

          for (const dbItem of allUnpaidItems) {
            const itemBytes32 = invoiceToBytes32(dbItem.id);

            // Check if this item belongs to the order
            if (itemBytes32Array.includes(itemBytes32)) {
              // Check if item is paid on blockchain
              const blockchainItem = await paymentBlockchainService.getItem(dbItem.id);

              if (blockchainItem.isPaid) {
                await this.processor.handleItemPaid({
                  id: dbItem.id,
                  vcID: dbItem.vcID,
                  timestamp: timestamp,
                  blockNumber: 0,
                  transactionHash: 'already-completed',
                });
              }
            }
          }

          logger.success(`[BlockchainWorker] ✅ Payment completion synced from blockchain: ${paymentId}`);
        } else {
          throw error;
        }
      }

      await prisma.blockchainTransaction.update({
        where: { id: transactionId },
        data: {
          status: 'CONFIRMED',
          txHash: receipt.hash,
          blockNumber: receipt.blockNumber,
          confirmedAt: new Date(),
          error: isAlreadyCompleted ? 'Payment already completed on blockchain, synced to database' : null,
        },
      });

      if (!isAlreadyCompleted) {
        logger.success(`[BlockchainWorker] ✅ COMPLETE_PAYMENT confirmed: ${paymentId} (tx: ${receipt.hash})`);

        // Immediately process the events to update database
        // Note: completePayment emits multiple events
        const timestamp = Date.now() / 1000;

        // 1. PaymentCompleted event
        logger.info(`[BlockchainWorker] Processing PaymentCompleted event for ${paymentId}...`);
        const payment = await paymentBlockchainService.getPayment(paymentId);
        await this.processor.handlePaymentCompleted({
          id: paymentId,
          orderID: orderId,
          method: method,
          amount: Number(payment.amount),
          timestamp: timestamp,
          blockNumber: receipt.blockNumber,
          transactionHash: receipt.hash,
        });

        // 2. PaymentStatusChanged event
        logger.info(`[BlockchainWorker] Processing PaymentStatusChanged event for ${paymentId}...`);
        await this.processor.handlePaymentStatusChanged({
          id: paymentId,
          orderID: orderId,
          oldStatus: 'PENDING',
          newStatus: successStatus,
          timestamp: timestamp,
          blockNumber: receipt.blockNumber,
          transactionHash: receipt.hash,
        });

        // 3. OrderStatusChanged event
        logger.info(`[BlockchainWorker] Processing OrderStatusChanged event for ${orderId}...`);
        await this.processor.handleOrderStatusChanged({
          id: orderId,
          oldStatus: 0, // PENDING
          newStatus: 2, // SUCCESS
          timestamp: timestamp,
          blockNumber: receipt.blockNumber,
          transactionHash: receipt.hash,
        });

        // 4. ItemPaid events (for each item in order)
        // Get items from database since blockchain returns bytes32 hashes for IDs
        logger.info(`[BlockchainWorker] Processing ItemPaid events for order ${orderId}...`);

        const dbItems = await prisma.itemBlockchain.findMany({
          where: {
            orders: {
              some: { id: orderId }
            }
          },
          select: { id: true, vcID: true }
        });

        for (const dbItem of dbItems) {
          await this.processor.handleItemPaid({
            id: dbItem.id,
            vcID: dbItem.vcID, // Use database value (original string)
            timestamp: timestamp,
            blockNumber: receipt.blockNumber,
            transactionHash: receipt.hash,
          });
        }

        logger.success(`[BlockchainWorker] ✅ All events processed for COMPLETE_PAYMENT: ${paymentId}`);
      }

      return {
        success: true,
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber,
      };
    } catch (error: any) {
      logger.error(`[BlockchainWorker] ❌ COMPLETE_PAYMENT failed: ${paymentId}`, error);

      await prisma.blockchainTransaction.update({
        where: { id: transactionId },
        data: {
          status: 'FAILED',
          error: error.message,
          failedAt: new Date(),
          retryCount: job.attemptsMade,
        },
      });

      throw error;
    }
  }

  /**
   * Process FAILED_PAYMENT transaction
   */
  private async processFailedPayment(job: Job): Promise<any> {
    const { paymentId, orderId, method, failedStatus } = job.data;
    const transactionId = `failed-payment-${paymentId}`;

    logger.info(`[BlockchainWorker] Processing FAILED_PAYMENT: ${paymentId}`);

    try {
      await prisma.blockchainTransaction.update({
        where: { id: transactionId },
        data: {
          status: 'PROCESSING',
          processedAt: new Date(),
          retryCount: job.attemptsMade,
        },
      });

      const receipt = await paymentBlockchainService.failedPayment(
        paymentId,
        orderId,
        method,
        failedStatus
      );

      await prisma.blockchainTransaction.update({
        where: { id: transactionId },
        data: {
          status: 'CONFIRMED',
          txHash: receipt.hash,
          blockNumber: receipt.blockNumber,
          confirmedAt: new Date(),
        },
      });

      logger.success(`[BlockchainWorker] ✅ FAILED_PAYMENT confirmed: ${paymentId} (tx: ${receipt.hash})`);

      // Immediately process the event to update database
      logger.info(`[BlockchainWorker] Processing PaymentFailed event for ${paymentId}...`);
      const payment = await paymentBlockchainService.getPayment(paymentId);
      await this.processor.handlePaymentFailed({
        id: paymentId,
        orderID: orderId,
        method: method,
        amount: Number(payment.amount),
        timestamp: Date.now() / 1000,
        blockNumber: receipt.blockNumber,
        transactionHash: receipt.hash,
      });
      logger.success(`[BlockchainWorker] ✅ PaymentFailed event processed for ${paymentId}`);

      return {
        success: true,
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber,
      };
    } catch (error: any) {
      logger.error(`[BlockchainWorker] ❌ FAILED_PAYMENT failed: ${paymentId}`, error);

      await prisma.blockchainTransaction.update({
        where: { id: transactionId },
        data: {
          status: 'FAILED',
          error: error.message,
          failedAt: new Date(),
          retryCount: job.attemptsMade,
        },
      });

      throw error;
    }
  }

  /**
   * Setup event listeners for queue
   */
  private setupEventListeners(): void {
    this.queue.on('completed', (job: Job, result: any) => {
      logger.info(`[BlockchainWorker] Job ${job.id} completed`, {
        type: job.name,
        result,
      });
    });

    this.queue.on('failed', (job: Job, err: Error) => {
      logger.error(`[BlockchainWorker] Job ${job.id} failed:`, {
        type: job.name,
        error: err.message,
        attempts: job.attemptsMade,
      });
    });

    this.queue.on('stalled', (job: Job) => {
      logger.warn(`[BlockchainWorker] Job ${job.id} stalled`, {
        type: job.name,
      });
    });

    this.queue.on('error', (error: Error) => {
      logger.error(`[BlockchainWorker] Queue error:`, error);
    });
  }

  /**
   * Start the worker
   */
  async start(): Promise<void> {
    logger.success('[BlockchainWorker] Worker started and listening for jobs');
  }

  /**
   * Stop the worker
   */
  async stop(): Promise<void> {
    await this.queue.close();
    logger.info('[BlockchainWorker] Worker stopped');
  }
}

// Create and export worker instance
const worker = new BlockchainTransactionWorker();
export default worker;
