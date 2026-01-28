import { Job } from "bull";
import { prisma } from "../config/database";
import logger from "../config/logger";
import blockchainTransactionQueueService from "../services/blockchain/blockchainTransactionQueue.service";
import paymentBlockchainService from "../services/blockchain/paymentBlockchain.service";
import PaymentEventProcessor from "../services/processors/paymentEventProcessor";
import { invoiceToBytes32 } from "../utils/blockchain.helper";

// Dependency wait configuration
const DEPENDENCY_CHECK_INTERVAL = 2000; // 2 seconds
const DEPENDENCY_MAX_WAIT_TIME = 300000; // 5 minutes
const DEPENDENCY_MAX_RETRIES = 3;

interface DependencyCheckResult {
  ready: boolean;
  status: string;
  transactionId: string;
  needsRetry: boolean;
}

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
   * Get the actual transaction ID (handles retry with originalTransactionId)
   */
  private getTransactionId(job: Job, defaultId: string): string {
    return job.data.originalTransactionId || defaultId;
  }

  // ==================== DEPENDENCY MANAGEMENT ====================

  /**
   * Check if a dependency transaction is ready (CONFIRMED)
   */
  private async checkDependency(transactionId: string): Promise<DependencyCheckResult> {
    try {
      const transaction = await prisma.blockchainTransaction.findUnique({
        where: { id: transactionId },
      });

      if (!transaction) {
        // Transaction not found - might not be created yet
        return {
          ready: false,
          status: 'NOT_FOUND',
          transactionId,
          needsRetry: false,
        };
      }

      return {
        ready: transaction.status === 'CONFIRMED',
        status: transaction.status,
        transactionId,
        needsRetry: transaction.status === 'FAILED',
      };
    } catch (error: any) {
      logger.error(`[DependencyCheck] Error checking dependency ${transactionId}:`, error);
      return {
        ready: false,
        status: 'ERROR',
        transactionId,
        needsRetry: false,
      };
    }
  }

  /**
   * Check multiple dependencies at once
   */
  private async checkMultipleDependencies(transactionIds: string[]): Promise<{
    allReady: boolean;
    results: DependencyCheckResult[];
  }> {
    const results = await Promise.all(
      transactionIds.map(id => this.checkDependency(id))
    );

    return {
      allReady: results.every(r => r.ready),
      results,
    };
  }

  /**
   * Wait for a single dependency to be CONFIRMED
   * If FAILED, retry it and wait again
   */
  private async waitForDependency(
    transactionId: string,
    dependentType: string,
    dependentId: string
  ): Promise<void> {
    const startTime = Date.now();
    let retryCount = 0;

    logger.info(`[DependencyWait] ${dependentType}:${dependentId} waiting for ${transactionId}`);

    while (Date.now() - startTime < DEPENDENCY_MAX_WAIT_TIME) {
      const result = await this.checkDependency(transactionId);

      if (result.ready) {
        logger.info(`[DependencyWait] ${transactionId} is CONFIRMED, proceeding with ${dependentType}:${dependentId}`);
        return;
      }

      if (result.status === 'NOT_FOUND') {
        // Dependency not created yet, wait and check again
        logger.debug(`[DependencyWait] ${transactionId} not found yet, waiting...`);
        await this.sleep(DEPENDENCY_CHECK_INTERVAL);
        continue;
      }

      if (result.needsRetry && retryCount < DEPENDENCY_MAX_RETRIES) {
        // Dependency failed, retry it
        logger.warn(`[DependencyWait] ${transactionId} is FAILED, retrying (attempt ${retryCount + 1}/${DEPENDENCY_MAX_RETRIES})`);

        const retryResult = await blockchainTransactionQueueService.retryTransaction(transactionId);

        if (retryResult.success) {
          retryCount++;
          // Wait a bit longer after retry
          await this.sleep(DEPENDENCY_CHECK_INTERVAL * 2);
          continue;
        } else {
          logger.error(`[DependencyWait] Failed to retry ${transactionId}: ${retryResult.message}`);
        }
      }

      if (result.needsRetry && retryCount >= DEPENDENCY_MAX_RETRIES) {
        throw new Error(`Dependency ${transactionId} failed after ${DEPENDENCY_MAX_RETRIES} retry attempts`);
      }

      // PENDING or PROCESSING, wait and check again
      await this.sleep(DEPENDENCY_CHECK_INTERVAL);
    }

    throw new Error(`Timeout waiting for dependency ${transactionId} (waited ${DEPENDENCY_MAX_WAIT_TIME}ms)`);
  }

  /**
   * Wait for multiple dependencies to be CONFIRMED
   */
  private async waitForMultipleDependencies(
    transactionIds: string[],
    dependentType: string,
    dependentId: string
  ): Promise<void> {
    if (transactionIds.length === 0) {
      return;
    }

    logger.info(`[DependencyWait] ${dependentType}:${dependentId} waiting for ${transactionIds.length} dependencies`);

    // First check if all are already confirmed
    const initialCheck = await this.checkMultipleDependencies(transactionIds);
    if (initialCheck.allReady) {
      logger.info(`[DependencyWait] All ${transactionIds.length} dependencies already CONFIRMED`);
      return;
    }

    // Wait for each dependency that's not ready
    for (const result of initialCheck.results) {
      if (!result.ready) {
        await this.waitForDependency(result.transactionId, dependentType, dependentId);
      }
    }
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ==================== QUEUE PROCESSORS ====================

  /**
   * Setup queue processors for different transaction types
   */
  private setupProcessors(): void {
    // Process CREATE_ITEM transactions
    this.queue.process("createItem", async (job: Job) => {
      return this.processCreateItem(job);
    });

    // Process CREATE_ORDER transactions
    this.queue.process("createOrder", async (job: Job) => {
      return this.processCreateOrder(job);
    });

    // Process CREATE_PAYMENT transactions
    this.queue.process("createPayment", async (job: Job) => {
      return this.processCreatePayment(job);
    });

    // Process COMPLETE_PAYMENT transactions
    this.queue.process("completePayment", async (job: Job) => {
      return this.processCompletePayment(job);
    });

    // Process FAILED_PAYMENT transactions
    this.queue.process("failedPayment", async (job: Job) => {
      return this.processFailedPayment(job);
    });

    // Setup event listeners
    this.setupEventListeners();

    logger.success("[BlockchainWorker] All processors initialized");
  }

  /**
   * Process CREATE_ITEM transaction
   */
  private async processCreateItem(job: Job): Promise<any> {
    const { itemId, price, vcID, issuerDID, holderDID, vcHash, itemType } =
      job.data;
    const transactionId = this.getTransactionId(job, itemId);

    logger.info(`[BlockchainWorker] Processing CREATE_ITEM: ${itemId} (txId: ${transactionId})`);

    try {
      // Update status to PROCESSING
      await prisma.blockchainTransaction.update({
        where: { id: transactionId },
        data: {
          status: "PROCESSING",
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
        if (error.message && error.message.includes("Item already exist")) {
          logger.warn(
            `[BlockchainWorker] ⚠️  Item already exists on blockchain: ${itemId}, syncing from blockchain...`
          );
          isAlreadyExist = true;

          // Get existing item from blockchain (for status/isPaid info)
          const existingItem = await paymentBlockchainService.getItem(itemId);

          // Create a pseudo-receipt for existing item
          receipt = {
            hash: "already-exists",
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
            transactionHash: "already-exists",
          });

          logger.success(
            `[BlockchainWorker] ✅ Item synced from blockchain: ${itemId}`
          );
        } else {
          // Other errors - rethrow
          throw error;
        }
      }

      // Update status to CONFIRMED
      await prisma.blockchainTransaction.update({
        where: { id: transactionId },
        data: {
          status: "CONFIRMED",
          txHash: receipt.hash,
          blockNumber: receipt.blockNumber,
          confirmedAt: new Date(),
          error: isAlreadyExist
            ? "Item already existed on blockchain, synced to database"
            : null,
        },
      });

      if (!isAlreadyExist) {
        logger.success(
          `[BlockchainWorker] ✅ CREATE_ITEM confirmed: ${itemId} (tx: ${receipt.hash})`
        );

        // Immediately process the event to update database
        logger.info(
          `[BlockchainWorker] Processing ItemCreated event for ${itemId}...`
        );
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
        logger.success(
          `[BlockchainWorker] ✅ ItemCreated event processed for ${itemId}`
        );
      }

      return {
        success: true,
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber,
      };
    } catch (error: any) {
      logger.error(
        `[BlockchainWorker] ❌ CREATE_ITEM failed: ${itemId}`,
        error
      );

      // Update status to FAILED
      await prisma.blockchainTransaction.update({
        where: { id: transactionId },
        data: {
          status: "FAILED",
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
   * Dependencies: All CREATE_ITEM transactions in itemIds must be CONFIRMED
   */
  private async processCreateOrder(job: Job): Promise<any> {
    const { orderId, holderDID, amount, currency, itemIds } = job.data;
    const transactionId = this.getTransactionId(job, orderId);

    logger.info(`[BlockchainWorker] Processing CREATE_ORDER: ${orderId} (txId: ${transactionId})`);

    try {
      // Wait for all item dependencies to be confirmed
      if (itemIds && itemIds.length > 0) {
        await this.waitForMultipleDependencies(itemIds, 'CREATE_ORDER', orderId);
      }

      await prisma.blockchainTransaction.update({
        where: { id: transactionId },
        data: {
          status: "PROCESSING",
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
        if (error.message && error.message.includes("Order already exist")) {
          logger.warn(
            `[BlockchainWorker] ⚠️  Order already exists on blockchain: ${orderId}, syncing from blockchain...`
          );
          isAlreadyExist = true;

          // Get existing order from blockchain (for status info)
          const existingOrder = await paymentBlockchainService.getOrder(
            orderId
          );

          // Create a pseudo-receipt for existing order
          receipt = {
            hash: "already-exists",
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
            transactionHash: "already-exists",
          });

          logger.success(
            `[BlockchainWorker] ✅ Order synced from blockchain: ${orderId}`
          );
        } else {
          throw error;
        }
      }

      await prisma.blockchainTransaction.update({
        where: { id: transactionId },
        data: {
          status: "CONFIRMED",
          txHash: receipt.hash,
          blockNumber: receipt.blockNumber,
          confirmedAt: new Date(),
          error: isAlreadyExist
            ? "Order already existed on blockchain, synced to database"
            : null,
        },
      });

      if (!isAlreadyExist) {
        logger.success(
          `[BlockchainWorker] ✅ CREATE_ORDER confirmed: ${orderId} (tx: ${receipt.hash})`
        );

        // Immediately process the event to update database
        logger.info(
          `[BlockchainWorker] Processing OrderCreated event for ${orderId}...`
        );
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
        logger.success(
          `[BlockchainWorker] ✅ OrderCreated event processed for ${orderId}`
        );
      }

      return {
        success: true,
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber,
      };
    } catch (error: any) {
      logger.error(
        `[BlockchainWorker] ❌ CREATE_ORDER failed: ${orderId}`,
        error
      );

      await prisma.blockchainTransaction.update({
        where: { id: transactionId },
        data: {
          status: "FAILED",
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
   * Dependencies: CREATE_ORDER with orderID must be CONFIRMED
   */
  private async processCreatePayment(job: Job): Promise<any> {
    const { paymentId, orderID, status, amount } = job.data;
    const transactionId = this.getTransactionId(job, paymentId);

    logger.info(`[BlockchainWorker] Processing CREATE_PAYMENT: ${paymentId} (txId: ${transactionId})`);

    try {
      // Wait for order dependency to be confirmed
      if (orderID) {
        await this.waitForDependency(orderID, 'CREATE_PAYMENT', paymentId);
      }

      await prisma.blockchainTransaction.update({
        where: { id: transactionId },
        data: {
          status: "PROCESSING",
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
        if (error.message && error.message.includes("Payment already exist")) {
          logger.warn(
            `[BlockchainWorker] ⚠️  Payment already exists on blockchain: ${paymentId}, syncing from blockchain...`
          );
          isAlreadyExist = true;

          // Get existing payment from blockchain (for amount info)
          const existingPayment = await paymentBlockchainService.getPayment(
            paymentId
          );

          // Create a pseudo-receipt for existing payment
          receipt = {
            hash: "already-exists",
            blockNumber: 0,
          };

          // Sync to database using ORIGINAL job data for strings
          // method/status from blockchain may be decoded properly since they're short
          await this.processor.handlePaymentCreated({
            id: paymentId,
            orderID: orderID, // Use original from job.data
            method: existingPayment.method || "", // May be decoded bytes32
            status: status, // Use original from job.data
            amount: Number(existingPayment.amount),
            timestamp: Date.now() / 1000,
            blockNumber: 0,
            transactionHash: "already-exists",
          });

          logger.success(
            `[BlockchainWorker] ✅ Payment synced from blockchain: ${paymentId}`
          );
        } else {
          throw error;
        }
      }

      await prisma.blockchainTransaction.update({
        where: { id: transactionId },
        data: {
          status: "CONFIRMED",
          txHash: receipt.hash,
          blockNumber: receipt.blockNumber,
          confirmedAt: new Date(),
          error: isAlreadyExist
            ? "Payment already existed on blockchain, synced to database"
            : null,
        },
      });

      if (!isAlreadyExist) {
        logger.success(
          `[BlockchainWorker] ✅ CREATE_PAYMENT confirmed: ${paymentId} (tx: ${receipt.hash})`
        );

        // Immediately process the event to update database
        logger.info(
          `[BlockchainWorker] Processing PaymentCreated event for ${paymentId}...`
        );
        await this.processor.handlePaymentCreated({
          id: paymentId,
          orderID: orderID,
          method: "", // Empty string - method is set later in completePayment
          status: status,
          amount: amount,
          timestamp: Date.now() / 1000,
          blockNumber: receipt.blockNumber,
          transactionHash: receipt.hash,
        });
        logger.success(
          `[BlockchainWorker] ✅ PaymentCreated event processed for ${paymentId}`
        );
      }

      return {
        success: true,
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber,
      };
    } catch (error: any) {
      logger.error(
        `[BlockchainWorker] ❌ CREATE_PAYMENT failed: ${paymentId}`,
        error
      );

      await prisma.blockchainTransaction.update({
        where: { id: transactionId },
        data: {
          status: "FAILED",
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
   * Dependencies: CREATE_PAYMENT with paymentId must be CONFIRMED
   */
  private async processCompletePayment(job: Job): Promise<any> {
    const { paymentId, orderId, method, successStatus } = job.data;
    const transactionId = this.getTransactionId(job, `complete-payment-${paymentId}`);

    logger.info(`[BlockchainWorker] Processing COMPLETE_PAYMENT: ${paymentId} (txId: ${transactionId})`);

    try {
      // Wait for payment dependency to be confirmed
      if (paymentId) {
        await this.waitForDependency(paymentId, 'COMPLETE_PAYMENT', paymentId);
      }

      await prisma.blockchainTransaction.update({
        where: { id: transactionId },
        data: {
          status: "PROCESSING",
          processedAt: new Date(),
          retryCount: job.attemptsMade,
        },
      });

      // Pre-check: Verify payment exists on blockchain before attempting to complete
      const paymentExistsPreCheck = await paymentBlockchainService.paymentExists(paymentId);
      if (!paymentExistsPreCheck) {
        logger.error(
          `[BlockchainWorker] ❌ Payment ${paymentId} does not exist on blockchain. Cannot complete payment.`
        );

        // Check CREATE_PAYMENT transaction status
        const createPaymentTx = await prisma.blockchainTransaction.findUnique({
          where: { id: paymentId },
        });

        if (!createPaymentTx) {
          throw new Error(`Payment ${paymentId} was never created. CREATE_PAYMENT transaction not found.`);
        }

        if (createPaymentTx.status === 'PENDING' || createPaymentTx.status === 'PROCESSING') {
          // CREATE_PAYMENT is still processing, delay this job
          logger.warn(
            `[BlockchainWorker] CREATE_PAYMENT ${paymentId} is still ${createPaymentTx.status}. Delaying COMPLETE_PAYMENT.`
          );
          throw new Error(`CREATE_PAYMENT ${paymentId} is still ${createPaymentTx.status}. Will retry later.`);
        }

        if (createPaymentTx.status === 'FAILED') {
          throw new Error(`Payment ${paymentId} creation failed. Cannot complete payment. Please retry CREATE_PAYMENT first.`);
        }

        // CREATE_PAYMENT is CONFIRMED but payment doesn't exist - data integrity issue
        throw new Error(`Payment ${paymentId} is marked CONFIRMED but does not exist on blockchain. Data integrity issue.`);
      }

      // Pre-check: Verify order exists and is pending
      const orderExistsPreCheck = await paymentBlockchainService.orderExists(orderId);
      if (!orderExistsPreCheck) {
        throw new Error(`Order ${orderId} does not exist on blockchain. Cannot complete payment.`);
      }

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
        // Check if payment doesn't exist on blockchain
        if (
          error.message &&
          (error.message.includes("PaymentNotFound") || error.message.includes("Payment not found"))
        ) {
          logger.error(
            `[BlockchainWorker] ❌ Payment ${paymentId} does not exist on blockchain. CREATE_PAYMENT may have failed.`
          );

          // Check if we should retry CREATE_PAYMENT
          const createPaymentTxExists = await prisma.blockchainTransaction.findUnique({
            where: { id: paymentId },
          });

          if (createPaymentTxExists && createPaymentTxExists.status === 'CONFIRMED') {
            logger.warn(
              `[BlockchainWorker] CREATE_PAYMENT ${paymentId} is marked CONFIRMED but payment doesn't exist on blockchain. Data integrity issue.`
            );
          }

          // Re-throw to mark job as failed - manual intervention needed
          throw new Error(`Payment ${paymentId} does not exist on blockchain. Please ensure CREATE_PAYMENT was successful.`);
        }

        // Check if order is already completed
        if (
          error.message &&
          error.message.includes("Order is not pending payment")
        ) {
          logger.warn(
            `[BlockchainWorker] ⚠️  Order already completed on blockchain: ${orderId}, syncing from blockchain...`
          );
          isAlreadyCompleted = true;

          // Check if order exists on blockchain before trying to get it
          const orderExistsOnChain = await paymentBlockchainService.orderExists(orderId);
          let existingOrder: any = null;

          if (orderExistsOnChain) {
            existingOrder = await paymentBlockchainService.getOrder(orderId);
          } else {
            logger.warn(
              `[BlockchainWorker] Order ${orderId} does not exist on blockchain, using default values for sync`
            );
          }

          // Check if payment exists on blockchain before trying to get it
          const paymentExistsOnChain = await paymentBlockchainService.paymentExists(paymentId);
          let existingPayment: any = null;

          if (paymentExistsOnChain) {
            existingPayment = await paymentBlockchainService.getPayment(paymentId);
          } else {
            logger.warn(
              `[BlockchainWorker] Payment ${paymentId} does not exist on blockchain, using job data for sync`
            );
          }

          // Create a pseudo-receipt for existing payment
          receipt = {
            hash: "already-completed",
            blockNumber: 0,
          };

          // Sync all events to database using ORIGINAL job data for strings
          const timestamp = Date.now() / 1000;

          // 1. PaymentCompleted event - use existingPayment.amount if available, otherwise skip or use 0
          logger.info(
            `[BlockchainWorker] Syncing PaymentCompleted event for ${paymentId}...`
          );
          await this.processor.handlePaymentCompleted({
            id: paymentId,
            orderID: orderId, // Use original from job.data
            method: method, // Use original from job.data
            amount: existingPayment ? Number(existingPayment.amount) : 0,
            timestamp: timestamp,
            blockNumber: 0,
            transactionHash: "already-completed",
          });

          // 2. PaymentStatusChanged event
          logger.info(
            `[BlockchainWorker] Syncing PaymentStatusChanged event for ${paymentId}...`
          );
          await this.processor.handlePaymentStatusChanged({
            id: paymentId,
            orderID: orderId, // Use original from job.data
            oldStatus: "PENDING",
            newStatus: successStatus, // Use original from job.data
            timestamp: timestamp,
            blockNumber: 0,
            transactionHash: "already-completed",
          });

          // 3. OrderStatusChanged event
          logger.info(
            `[BlockchainWorker] Syncing OrderStatusChanged event for ${orderId}...`
          );
          await this.processor.handleOrderStatusChanged({
            id: orderId,
            oldStatus: 0, // PENDING
            newStatus: existingOrder ? Number(existingOrder.status) : 2, // Default to SUCCESS (2) if order not found
            timestamp: timestamp,
            blockNumber: 0,
            transactionHash: "already-completed",
          });

          // 4. ItemPaid events (for each item in order)
          logger.info(
            `[BlockchainWorker] Syncing ItemPaid events for order ${orderId}...`
          );

          // FIX: Instead of querying non-existent relation, get items from Order table
          const orderRecord = await prisma.order.findUnique({
            where: { id: orderId },
            select: { VCs_id: true },
          });

          if (
            orderRecord &&
            orderRecord.VCs_id &&
            orderRecord.VCs_id.length > 0
          ) {
            const dbItems = await prisma.itemBlockchain.findMany({
              where: {
                id: { in: orderRecord.VCs_id },
              },
              select: { id: true, vcID: true },
            });

            for (const dbItem of dbItems) {
              // Check if item is paid on blockchain
              const blockchainItem = await paymentBlockchainService.getItem(
                dbItem.id
              );

              if (blockchainItem.isPaid) {
                await this.processor.handleItemPaid({
                  id: dbItem.id,
                  vcID: dbItem.vcID,
                  timestamp: timestamp,
                  blockNumber: 0,
                  transactionHash: "already-completed",
                });
              }
            }
          }

          logger.success(
            `[BlockchainWorker] ✅ Payment completion synced from blockchain: ${paymentId}`
          );
        } else {
          throw error;
        }
      }

      await prisma.blockchainTransaction.update({
        where: { id: transactionId },
        data: {
          status: "CONFIRMED",
          txHash: receipt.hash,
          blockNumber: receipt.blockNumber,
          confirmedAt: new Date(),
          error: isAlreadyCompleted
            ? "Payment already completed on blockchain, synced to database"
            : null,
        },
      });

      if (!isAlreadyCompleted) {
        logger.success(
          `[BlockchainWorker] ✅ COMPLETE_PAYMENT confirmed: ${paymentId} (tx: ${receipt.hash})`
        );

        // Immediately process the events to update database
        // Note: completePayment emits multiple events
        const timestamp = Date.now() / 1000;

        // 1. PaymentCompleted event
        logger.info(
          `[BlockchainWorker] Processing PaymentCompleted event for ${paymentId}...`
        );
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
        logger.info(
          `[BlockchainWorker] Processing PaymentStatusChanged event for ${paymentId}...`
        );
        await this.processor.handlePaymentStatusChanged({
          id: paymentId,
          orderID: orderId,
          oldStatus: "PENDING",
          newStatus: successStatus,
          timestamp: timestamp,
          blockNumber: receipt.blockNumber,
          transactionHash: receipt.hash,
        });

        // 3. OrderStatusChanged event
        logger.info(
          `[BlockchainWorker] Processing OrderStatusChanged event for ${orderId}...`
        );
        await this.processor.handleOrderStatusChanged({
          id: orderId,
          oldStatus: 0, // PENDING
          newStatus: 2, // SUCCESS
          timestamp: timestamp,
          blockNumber: receipt.blockNumber,
          transactionHash: receipt.hash,
        });

        // 4. ItemPaid events (for each item in order)
        logger.info(
          `[BlockchainWorker] Processing ItemPaid events for order ${orderId}...`
        );

        // Get itemIds from the CREATE_ORDER transaction's payload
        const createOrderTransaction = await prisma.blockchainTransaction.findUnique({
          where: { id: orderId },
          select: { payload: true },
        });

        if (createOrderTransaction && createOrderTransaction.payload) {
          try {
            const orderPayload = JSON.parse(createOrderTransaction.payload);
            const itemIds = orderPayload.itemIds || [];

            if (itemIds.length > 0) {
              const dbItems = await prisma.itemBlockchain.findMany({
                where: {
                  id: { in: itemIds },
                },
                select: { id: true, vcID: true },
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

              logger.info(
                `[BlockchainWorker] Processed ${dbItems.length} ItemPaid events for order ${orderId}`
              );
            } else {
              logger.warn(
                `[BlockchainWorker] No itemIds found in CREATE_ORDER payload for order ${orderId}`
              );
            }
          } catch (parseError: any) {
            logger.error(
              `[BlockchainWorker] Failed to parse CREATE_ORDER payload for order ${orderId}:`,
              parseError
            );
          }
        } else {
          logger.warn(
            `[BlockchainWorker] CREATE_ORDER transaction not found for order ${orderId}`
          );
        }

        logger.success(
          `[BlockchainWorker] ✅ All events processed for COMPLETE_PAYMENT: ${paymentId}`
        );
      }

      return {
        success: true,
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber,
      };
    } catch (error: any) {
      logger.error(
        `[BlockchainWorker] ❌ COMPLETE_PAYMENT failed: ${paymentId}`,
        error
      );

      await prisma.blockchainTransaction.update({
        where: { id: transactionId },
        data: {
          status: "FAILED",
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
   * Dependencies: CREATE_PAYMENT with paymentId must be CONFIRMED
   */
  private async processFailedPayment(job: Job): Promise<any> {
    const { paymentId, orderId, method, failedStatus } = job.data;
    const transactionId = this.getTransactionId(job, `failed-payment-${paymentId}`);

    logger.info(`[BlockchainWorker] Processing FAILED_PAYMENT: ${paymentId} (txId: ${transactionId})`);

    try {
      // Wait for payment dependency to be confirmed
      if (paymentId) {
        await this.waitForDependency(paymentId, 'FAILED_PAYMENT', paymentId);
      }

      await prisma.blockchainTransaction.update({
        where: { id: transactionId },
        data: {
          status: "PROCESSING",
          processedAt: new Date(),
          retryCount: job.attemptsMade,
        },
      });

      // Pre-check: Verify payment exists on blockchain before attempting to mark as failed
      const paymentExistsPreCheck = await paymentBlockchainService.paymentExists(paymentId);
      if (!paymentExistsPreCheck) {
        logger.error(
          `[BlockchainWorker] ❌ Payment ${paymentId} does not exist on blockchain. Cannot mark as failed.`
        );

        // Check CREATE_PAYMENT transaction status
        const createPaymentTx = await prisma.blockchainTransaction.findUnique({
          where: { id: paymentId },
        });

        if (!createPaymentTx) {
          throw new Error(`Payment ${paymentId} was never created. CREATE_PAYMENT transaction not found.`);
        }

        if (createPaymentTx.status === 'PENDING' || createPaymentTx.status === 'PROCESSING') {
          logger.warn(
            `[BlockchainWorker] CREATE_PAYMENT ${paymentId} is still ${createPaymentTx.status}. Delaying FAILED_PAYMENT.`
          );
          throw new Error(`CREATE_PAYMENT ${paymentId} is still ${createPaymentTx.status}. Will retry later.`);
        }

        if (createPaymentTx.status === 'FAILED') {
          throw new Error(`Payment ${paymentId} creation failed. Cannot mark as failed.`);
        }

        throw new Error(`Payment ${paymentId} is marked CONFIRMED but does not exist on blockchain. Data integrity issue.`);
      }

      // Pre-check: Verify order exists
      const orderExistsPreCheck = await paymentBlockchainService.orderExists(orderId);
      if (!orderExistsPreCheck) {
        throw new Error(`Order ${orderId} does not exist on blockchain. Cannot mark payment as failed.`);
      }

      const receipt = await paymentBlockchainService.failedPayment(
        paymentId,
        orderId,
        method,
        failedStatus
      );

      await prisma.blockchainTransaction.update({
        where: { id: transactionId },
        data: {
          status: "CONFIRMED",
          txHash: receipt.hash,
          blockNumber: receipt.blockNumber,
          confirmedAt: new Date(),
        },
      });

      logger.success(
        `[BlockchainWorker] ✅ FAILED_PAYMENT confirmed: ${paymentId} (tx: ${receipt.hash})`
      );

      // Immediately process the event to update database
      logger.info(
        `[BlockchainWorker] Processing PaymentFailed event for ${paymentId}...`
      );
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
      logger.success(
        `[BlockchainWorker] ✅ PaymentFailed event processed for ${paymentId}`
      );

      return {
        success: true,
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber,
      };
    } catch (error: any) {
      logger.error(
        `[BlockchainWorker] ❌ FAILED_PAYMENT failed: ${paymentId}`,
        error
      );

      await prisma.blockchainTransaction.update({
        where: { id: transactionId },
        data: {
          status: "FAILED",
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
    this.queue.on("completed", (job: Job, result: any) => {
      logger.info(`[BlockchainWorker] Job ${job.id} completed`, {
        type: job.name,
        result,
      });
    });

    this.queue.on("failed", (job: Job, err: Error) => {
      logger.error(`[BlockchainWorker] Job ${job.id} failed:`, {
        type: job.name,
        error: err.message,
        attempts: job.attemptsMade,
      });
    });

    this.queue.on("stalled", (job: Job) => {
      logger.warn(`[BlockchainWorker] Job ${job.id} stalled`, {
        type: job.name,
      });
    });

    this.queue.on("error", (error: Error) => {
      logger.error(`[BlockchainWorker] Queue error:`, error);
    });
  }

  /**
   * Start the worker
   */
  async start(): Promise<void> {
    logger.success("[BlockchainWorker] Worker started and listening for jobs");
  }

  /**
   * Stop the worker
   */
  async stop(): Promise<void> {
    await this.queue.close();
    logger.info("[BlockchainWorker] Worker stopped");
  }
}

// Create and export worker instance
const worker = new BlockchainTransactionWorker();
export default worker;
