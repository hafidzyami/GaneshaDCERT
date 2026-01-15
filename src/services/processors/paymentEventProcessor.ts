import { PrismaClient } from "@prisma/client";
import logger from "../../config/logger";
import { CredentialService } from "../credential.service";

/**
 * Payment Event Processor
 * Handles blockchain events from PaymentManager contract
 *
 * Note: Event enrichment is done in paymentEventPublisher
 *
 * Bytes32 Contract Support:
 * - This processor receives data from blockchainTransactionWorker
 * - The worker ensures original string values are passed (not bytes32 hashes)
 * - DIDs, vcIDs, and long strings are hashed to bytes32 in the optimized contract
 * - Since hashes can't be reversed, we use original job data or database values
 * - Short strings like currency, status, method are decoded from bytes32
 *
 * IMPORTANT: Redundancy Prevention
 * - BlockchainTransactionWorker processes events immediately after tx confirmation with original data
 * - PaymentEventPublisher also listens for events but receives bytes32 hashes
 * - To prevent data corruption, we check if data already exists before updating
 * - If existing data is valid (not bytes32 hash), we skip updates from event listener
 */
class PaymentEventProcessor {
  private prisma: PrismaClient;
  private credentialService: CredentialService;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.credentialService = new CredentialService({ db: prisma });
  }

  /**
   * Check if a string is a bytes32 hash (0x followed by 64 hex characters)
   * These are keccak256 hashes that cannot be decoded back to original strings
   */
  private isBytes32Hash(value: string): boolean {
    if (!value) return false;
    // Check if it's a hex string starting with 0x and has 66 characters (0x + 64 hex chars)
    return /^0x[a-fA-F0-9]{64}$/.test(value);
  }

  /**
   * Check if data from event contains undecodable bytes32 hashes
   * Returns true if any critical field is a hash that should be a readable string
   */
  private hasBytes32Data(data: { [key: string]: any }, fields: string[]): boolean {
    for (const field of fields) {
      if (data[field] && this.isBytes32Hash(data[field])) {
        return true;
      }
    }
    return false;
  }

  /**
   * Handle OrderCreated event
   *
   * IMPORTANT: Handles redundancy between worker and event listener
   * - If event data contains bytes32 hashes and record already exists with proper data, skip update
   */
  async handleOrderCreated(eventData: {
    id: string;
    holderDID: string;
    status: number;
    amount: number;
    currency: string;
    timestamp: number;
    blockNumber: number;
    transactionHash: string;
  }): Promise<void> {
    logger.info(`Processing OrderCreated event:`, {
      id: eventData.id,
      holderDID: eventData.holderDID,
      status: eventData.status,
      amount: eventData.amount,
      currency: eventData.currency,
      isIdHash: this.isBytes32Hash(eventData.id),
      isHolderDIDHash: this.isBytes32Hash(eventData.holderDID),
    });

    try {
      // Check if event data contains bytes32 hashes
      const hasHashData = this.hasBytes32Data(eventData, ['id', 'holderDID']);

      if (hasHashData) {
        // Try to find existing order by transaction hash
        const existingByTxHash = await this.prisma.orderBlockchain.findFirst({
          where: { txHash: eventData.transactionHash },
        });

        if (existingByTxHash) {
          logger.info(
            `ℹ️ Order already exists with proper data (found by txHash): ${existingByTxHash.id}. Skipping update with hash data.`
          );
          return;
        }

        // If ID is a hash, we can't create a proper record - skip
        if (this.isBytes32Hash(eventData.id)) {
          logger.warn(
            `⚠️ OrderCreated event has bytes32 hash ID. Cannot create record. Worker should handle this.`
          );
          return;
        }
      }

      // Check if order already exists with proper data (non-hash holderDID)
      const existingOrder = await this.prisma.orderBlockchain.findUnique({
        where: { id: eventData.id },
      });

      if (existingOrder && !this.isBytes32Hash(existingOrder.holderDID) && this.isBytes32Hash(eventData.holderDID)) {
        logger.info(
          `ℹ️ Order ${eventData.id} already has proper holderDID. Skipping update with hash data.`
        );
        return;
      }

      // Map status number to enum
      const statusMap: {
        [key: number]:
          | "NONE"
          | "PENDING_PAYMENT"
          | "SUCCESS"
          | "CANCELED";
      } = {
        0: "NONE",
        1: "PENDING_PAYMENT",
        2: "SUCCESS",
        3: "CANCELED",
      };

      const status = statusMap[eventData.status] || "NONE";

      // Upsert order to database
      const result = await this.prisma.orderBlockchain.upsert({
        where: {
          id: eventData.id,
        },
        create: {
          id: eventData.id,
          holderDID: eventData.holderDID,
          status: status,
          amount: eventData.amount,
          currency: eventData.currency,
          blockNumber: eventData.blockNumber,
          txHash: eventData.transactionHash,
          createdAt: new Date(Number(eventData.timestamp) * 1000),
        },
        update: {
          // Only update holderDID if new data is not a hash or existing is a hash
          ...((!this.isBytes32Hash(eventData.holderDID) || (existingOrder && this.isBytes32Hash(existingOrder.holderDID))) && {
            holderDID: eventData.holderDID,
          }),
          status: status,
          amount: eventData.amount,
          currency: eventData.currency,
          blockNumber: eventData.blockNumber,
          txHash: eventData.transactionHash,
          updatedAt: new Date(),
        },
      });

      logger.success(
        `Order upserted in database: ${eventData.id} (status: ${status})`
      );
    } catch (error: any) {
      logger.error("❌ Error handling OrderCreated event:", {
        error: error.message,
        stack: error.stack,
        eventData: {
          id: eventData.id,
          holderDID: eventData.holderDID,
          currency: eventData.currency,
          amount: eventData.amount,
          timestamp: eventData.timestamp,
        },
      });
      throw error;
    }
  }

  /**
   * Handle OrderStatusChanged event
   *
   * IMPORTANT: Handles redundancy between worker and event listener
   */
  async handleOrderStatusChanged(eventData: {
    id: string;
    oldStatus: number;
    newStatus: number;
    timestamp: number;
    blockNumber: number;
    transactionHash: string;
  }): Promise<void> {
    logger.info(`Processing OrderStatusChanged event:`, {
      id: eventData.id,
      oldStatus: eventData.oldStatus,
      newStatus: eventData.newStatus,
      isIdHash: this.isBytes32Hash(eventData.id),
    });

    try {
      // Map status number to enum
      const statusMap: {
        [key: number]:
          | "NONE"
          | "PENDING_PAYMENT"
          | "SUCCESS"
          | "CANCELED";
      } = {
        0: "NONE",
        1: "PENDING_PAYMENT",
        2: "SUCCESS",
        3: "CANCELED",
      };

      const newStatus = statusMap[eventData.newStatus] || "NONE";

      // If ID is a bytes32 hash, try to find by txHash
      let existingOrder;
      if (this.isBytes32Hash(eventData.id)) {
        existingOrder = await this.prisma.orderBlockchain.findFirst({
          where: { txHash: eventData.transactionHash },
        });

        if (!existingOrder) {
          logger.warn(
            `⚠️ OrderStatusChanged event has bytes32 hash ID and no matching record found. Skipping.`
          );
          return;
        }
      } else {
        existingOrder = await this.prisma.orderBlockchain.findUnique({
          where: { id: eventData.id },
        });
      }

      if (!existingOrder) {
        logger.warn(
          `⚠️ Order not found in database: ${eventData.id}. Skipping status update.`
        );
        logger.info(
          `This can happen if the database was reset but blockchain still has historical events.`
        );
        return; // Gracefully skip this event
      }

      // Check if status is already the same (avoid duplicate processing)
      if (existingOrder.status === newStatus) {
        logger.info(
          `ℹ️ Order ${existingOrder.id} already has status ${newStatus}. Skipping duplicate update.`
        );
        return;
      }

      // Update order status
      const result = await this.prisma.orderBlockchain.update({
        where: {
          id: existingOrder.id,
        },
        data: {
          status: newStatus,
          blockNumber: eventData.blockNumber,
          txHash: eventData.transactionHash,
          updatedAt: new Date(),
        },
      });

      logger.success(
        `Order status updated: ${existingOrder.id} -> ${newStatus}`
      );
    } catch (error: any) {
      logger.error("❌ Error handling OrderStatusChanged event:", {
        error: error.message,
        stack: error.stack,
        eventData: {
          id: eventData.id,
          timestamp: eventData.timestamp,
        },
      });
      throw error;
    }
  }

  /**
   * Handle ItemCreated event
   *
   * IMPORTANT: Handles redundancy between worker and event listener
   * - If event data contains bytes32 hashes and record already exists with proper data, skip update
   */
  async handleItemCreated(eventData: {
    id: string;
    vcID: string;
    issuerDID: string;
    holderDID: string;
    vcHash: string;
    price: number;
    itemType: number;
    timestamp: number;
    blockNumber: number;
    transactionHash: string;
  }): Promise<void> {
    logger.info(`Processing ItemCreated event:`, {
      id: eventData.id,
      vcID: eventData.vcID,
      issuerDID: eventData.issuerDID,
      holderDID: eventData.holderDID,
      vcHash: eventData.vcHash,
      price: eventData.price,
      itemType: eventData.itemType,
      isIdHash: this.isBytes32Hash(eventData.id),
      isVcIDHash: this.isBytes32Hash(eventData.vcID),
    });

    try {
      // Check if event data contains bytes32 hashes
      const criticalFields = ['id', 'vcID', 'issuerDID', 'holderDID'];
      const hasHashData = this.hasBytes32Data(eventData, criticalFields);

      if (hasHashData) {
        // Try to find existing item by transaction hash
        const existingByTxHash = await this.prisma.itemBlockchain.findFirst({
          where: { txHash: eventData.transactionHash },
        });

        if (existingByTxHash) {
          logger.info(
            `ℹ️ Item already exists with proper data (found by txHash): ${existingByTxHash.id}. Skipping update with hash data.`
          );
          return;
        }

        // If ID is a hash, we can't create a proper record - skip
        if (this.isBytes32Hash(eventData.id)) {
          logger.warn(
            `⚠️ ItemCreated event has bytes32 hash ID. Cannot create record. Worker should handle this.`
          );
          return;
        }
      }

      // Check if item already exists with proper data
      const existingItem = await this.prisma.itemBlockchain.findUnique({
        where: { id: eventData.id },
      });

      // If existing item has proper data and new data has hashes, preserve existing data
      if (existingItem) {
        const existingHasProperData = !this.isBytes32Hash(existingItem.vcID) &&
                                       !this.isBytes32Hash(existingItem.issuerDID) &&
                                       !this.isBytes32Hash(existingItem.holderDID);
        const newHasHashData = this.isBytes32Hash(eventData.vcID) ||
                               this.isBytes32Hash(eventData.issuerDID) ||
                               this.isBytes32Hash(eventData.holderDID);

        if (existingHasProperData && newHasHashData) {
          logger.info(
            `ℹ️ Item ${eventData.id} already has proper data. Skipping update with hash data.`
          );
          return;
        }
      }

      // Map itemType number to enum
      const itemTypeMap: {
        [key: number]: "ISSUANCE" | "RENEWAL" | "UPDATE";
      } = {
        0: "ISSUANCE",
        1: "RENEWAL",
        2: "UPDATE",
      };

      const itemType = itemTypeMap[eventData.itemType] || "ISSUANCE";

      // Determine which fields to update - don't overwrite good data with hashes
      const updateData: any = {
        price: eventData.price,
        itemType: itemType,
        blockNumber: eventData.blockNumber,
        txHash: eventData.transactionHash,
        updatedAt: new Date(),
      };

      // Only update string fields if they are not hashes (or if existing data is also hash)
      if (!this.isBytes32Hash(eventData.issuerDID) || (existingItem && this.isBytes32Hash(existingItem.issuerDID))) {
        updateData.issuerDID = eventData.issuerDID;
      }
      if (!this.isBytes32Hash(eventData.holderDID) || (existingItem && this.isBytes32Hash(existingItem.holderDID))) {
        updateData.holderDID = eventData.holderDID;
      }
      if (!this.isBytes32Hash(eventData.vcID) || (existingItem && this.isBytes32Hash(existingItem.vcID))) {
        updateData.vcID = eventData.vcID;
      }
      if (!this.isBytes32Hash(eventData.vcHash) || (existingItem && this.isBytes32Hash(existingItem.vcHash))) {
        updateData.vcHash = eventData.vcHash;
      }

      // Upsert item to database
      const result = await this.prisma.itemBlockchain.upsert({
        where: {
          id: eventData.id,
        },
        create: {
          id: eventData.id,
          issuerDID: eventData.issuerDID,
          holderDID: eventData.holderDID,
          price: eventData.price,
          vcID: eventData.vcID,
          vcHash: eventData.vcHash,
          itemType: itemType,
          isPaid: false,
          blockNumber: eventData.blockNumber,
          txHash: eventData.transactionHash,
        },
        update: updateData,
      });

      logger.success(
        `Item upserted in database: ${eventData.id} (type: ${itemType})`
      );
    } catch (error: any) {
      logger.error("❌ Error handling ItemCreated event:", {
        error: error.message,
        stack: error.stack,
        eventData: {
          id: eventData.id,
          vcID: eventData.vcID,
          vcHash: eventData.vcHash,
          price: eventData.price,
          timestamp: eventData.timestamp,
        },
      });
      throw error;
    }
  }

  /**
   * Handle ItemPaid event
   * Triggers automatic VC issuance/renewal/update after payment completion
   *
   * IMPORTANT: This method handles redundancy between worker and event listener:
   * - Worker calls this with original string IDs
   * - Event listener may call this with bytes32 hashes if enrichment fails
   * - We check if isPaid is already true to avoid duplicate processing
   * - We check if event data contains bytes32 hashes and try to find by other means
   */
  async handleItemPaid(eventData: {
    id: string;
    vcID: string;
    timestamp: number;
    blockNumber: number;
    transactionHash: string;
  }): Promise<void> {
    logger.info(`Processing ItemPaid event:`, {
      id: eventData.id,
      vcID: eventData.vcID,
      isIdHash: this.isBytes32Hash(eventData.id),
      isVcIdHash: this.isBytes32Hash(eventData.vcID),
    });

    try {
      // Check if event data contains bytes32 hashes (from event listener)
      const hasHashData = this.hasBytes32Data(eventData, ['id', 'vcID']);

      let existingItem;

      if (hasHashData) {
        // Event data contains bytes32 hashes - try to find by other means
        logger.warn(
          `⚠️ ItemPaid event contains bytes32 hash data. Attempting to find item by other criteria...`
        );

        // Try to find by transaction hash first (most reliable)
        existingItem = await this.prisma.itemBlockchain.findFirst({
          where: {
            txHash: eventData.transactionHash,
          },
        });

        if (!existingItem) {
          // Try to find item that was recently updated and not yet marked as paid
          // This is a fallback - ideally worker should have already processed this
          logger.warn(
            `⚠️ Could not find item by txHash. Event from blockchain may already be processed by worker.`
          );
          logger.info(
            `Skipping ItemPaid event with hash data - worker should have already processed with original IDs.`
          );
          return;
        }

        logger.info(`Found item by alternative criteria: ${existingItem.id}`);
      } else {
        // Normal path - ID is a readable string
        existingItem = await this.prisma.itemBlockchain.findUnique({
          where: { id: eventData.id },
        });
      }

      if (!existingItem) {
        logger.warn(
          `⚠️ Item not found in database: ${eventData.id}. Skipping paid status update.`
        );
        return; // Gracefully skip this event
      }

      // CRITICAL: Check if item is already marked as paid
      // This prevents redundant processing from event listener after worker has already processed
      if (existingItem.isPaid) {
        logger.info(
          `ℹ️ Item ${existingItem.id} is already marked as paid. Skipping duplicate processing.`
        );
        // Still trigger credential operations in case they failed before
        await this.triggerCredentialOperation(existingItem);
        return;
      }

      // 1. Update item isPaid status
      const result = await this.prisma.itemBlockchain.update({
        where: {
          id: existingItem.id, // Use existingItem.id to ensure we use the correct ID
        },
        data: {
          isPaid: true,
          blockNumber: eventData.blockNumber,
          txHash: eventData.transactionHash,
          updatedAt: new Date(),
        },
      });

      logger.success(`✅ Item marked as paid: ${existingItem.id}`);

      // 2. Trigger credential operations
      await this.triggerCredentialOperation(result);

    } catch (error: any) {
      logger.error("❌ Error handling ItemPaid event:", {
        error: error.message,
        stack: error.stack,
        eventData: {
          id: eventData.id,
          vcID: eventData.vcID,
          timestamp: eventData.timestamp,
        },
      });
      throw error;
    }
  }

  /**
   * Trigger appropriate credential operation based on itemType
   * Extracted as a separate method to be called both after marking paid and for retry
   */
  private async triggerCredentialOperation(item: {
    id: string;
    itemType: string;
    vcID: string;
    vcHash: string;
  }): Promise<void> {
    logger.info(`Item details for credential operation:`, {
      itemType: item.itemType,
      vcID: item.vcID,
      vcHash: item.vcHash,
    });

    try {
      switch (item.itemType) {
        case "ISSUANCE":
          logger.info(`🚀 Triggering automatic VC issuance for: ${item.vcID}`);
          await this.credentialService.completeIssuanceAfterPayment(
            item.vcID,
            item.vcHash
          );
          logger.success(
            `✅ Automatic issuance completed for VC: ${item.vcID}`
          );
          break;

        case "RENEWAL":
          logger.info(`🚀 Triggering automatic VC renewal for: ${item.vcID}`);
          await this.credentialService.completeRenewalAfterPayment(
            item.vcID,
            item.vcHash
          );
          logger.success(
            `✅ Automatic renewal completed for VC: ${item.vcID}`
          );
          break;

        case "UPDATE":
          logger.info(`🚀 Triggering automatic VC update for: ${item.vcID}`);
          await this.credentialService.completeUpdateAfterPayment(
            item.vcID,
            item.vcHash
          );
          logger.success(
            `✅ Automatic update completed for VC: ${item.vcID}`
          );
          break;

        default:
          logger.warn(
            `⚠️ Unknown itemType: ${item.itemType} for item ${item.id}`
          );
      }
    } catch (credentialError: any) {
      logger.error(
        `❌ Failed to complete credential operation for item ${item.id}:`,
        {
          error: credentialError.message,
          stack: credentialError.stack,
          itemType: item.itemType,
          vcID: item.vcID,
        }
      );
      // Don't throw - we've already marked the item as paid
      // The admin can retry manually if needed
    }
  }

  /**
   * Handle PaymentCreated event
   *
   * IMPORTANT: Handles redundancy between worker and event listener
   * - If event data contains bytes32 hashes and record already exists with proper data, skip update
   */
  async handlePaymentCreated(eventData: {
    id: string;
    orderID: string;
    method: string;
    status: string;
    amount: number;
    timestamp: number;
    blockNumber: number;
    transactionHash: string;
  }): Promise<void> {
    logger.info(`Processing PaymentCreated event:`, {
      id: eventData.id,
      orderID: eventData.orderID,
      method: eventData.method,
      status: eventData.status,
      amount: eventData.amount,
      isIdHash: this.isBytes32Hash(eventData.id),
      isOrderIDHash: this.isBytes32Hash(eventData.orderID),
    });

    try {
      // Check if event data contains bytes32 hashes
      const hasHashData = this.hasBytes32Data(eventData, ['id', 'orderID']);

      if (hasHashData) {
        // Try to find existing payment by transaction hash
        const existingByTxHash = await this.prisma.paymentBlockchain.findFirst({
          where: { txHash: eventData.transactionHash },
        });

        if (existingByTxHash) {
          logger.info(
            `ℹ️ Payment already exists with proper data (found by txHash): ${existingByTxHash.id}. Skipping update with hash data.`
          );
          return;
        }

        // If ID is a hash, we can't create a proper record - skip
        if (this.isBytes32Hash(eventData.id)) {
          logger.warn(
            `⚠️ PaymentCreated event has bytes32 hash ID. Cannot create record. Worker should handle this.`
          );
          return;
        }
      }

      // Check if payment already exists with proper data
      const existingPayment = await this.prisma.paymentBlockchain.findUnique({
        where: { id: eventData.id },
      });

      // If existing payment has proper orderID and new data has hash, preserve existing
      if (existingPayment && !this.isBytes32Hash(existingPayment.orderID) && this.isBytes32Hash(eventData.orderID)) {
        logger.info(
          `ℹ️ Payment ${eventData.id} already has proper orderID. Skipping update with hash data.`
        );
        return;
      }

      // Determine which fields to update
      const updateData: any = {
        method: eventData.method,
        status: eventData.status,
        amount: eventData.amount,
        blockNumber: eventData.blockNumber,
        txHash: eventData.transactionHash,
        updatedAt: new Date(),
      };

      // Only update orderID if it's not a hash (or existing is also hash)
      if (!this.isBytes32Hash(eventData.orderID) || (existingPayment && this.isBytes32Hash(existingPayment.orderID))) {
        updateData.orderID = eventData.orderID;
      }

      // Upsert payment to database
      const result = await this.prisma.paymentBlockchain.upsert({
        where: {
          id: eventData.id,
        },
        create: {
          id: eventData.id,
          orderID: eventData.orderID,
          method: eventData.method,
          status: eventData.status,
          amount: eventData.amount,
          paidAt: null,
          blockNumber: eventData.blockNumber,
          txHash: eventData.transactionHash,
        },
        update: updateData,
      });

      logger.success(
        `Payment upserted in database: ${eventData.id} (status: ${eventData.status})`
      );
    } catch (error: any) {
      logger.error("❌ Error handling PaymentCreated event:", {
        error: error.message,
        stack: error.stack,
        eventData: {
          id: eventData.id,
          orderID: eventData.orderID,
          method: eventData.method,
          status: eventData.status,
          amount: eventData.amount,
          timestamp: eventData.timestamp,
        },
      });
      throw error;
    }
  }

  /**
   * Handle PaymentStatusChanged event
   *
   * IMPORTANT: Handles redundancy between worker and event listener
   */
  async handlePaymentStatusChanged(eventData: {
    id: string;
    orderID: string;
    oldStatus: string;
    newStatus: string;
    timestamp: number;
    blockNumber: number;
    transactionHash: string;
  }): Promise<void> {
    logger.info(`Processing PaymentStatusChanged event:`, {
      id: eventData.id,
      orderID: eventData.orderID,
      oldStatus: eventData.oldStatus,
      newStatus: eventData.newStatus,
      isIdHash: this.isBytes32Hash(eventData.id),
    });

    try {
      // If ID is a bytes32 hash, try to find by txHash
      let existingPayment;
      if (this.isBytes32Hash(eventData.id)) {
        existingPayment = await this.prisma.paymentBlockchain.findFirst({
          where: { txHash: eventData.transactionHash },
        });

        if (!existingPayment) {
          logger.warn(
            `⚠️ PaymentStatusChanged event has bytes32 hash ID and no matching record found. Skipping.`
          );
          return;
        }
      } else {
        existingPayment = await this.prisma.paymentBlockchain.findUnique({
          where: { id: eventData.id },
        });
      }

      if (!existingPayment) {
        logger.warn(
          `⚠️ Payment not found in database: ${eventData.id}. Skipping status update.`
        );
        return; // Gracefully skip this event
      }

      // Check if status is already the same (avoid duplicate processing)
      if (existingPayment.status === eventData.newStatus) {
        logger.info(
          `ℹ️ Payment ${existingPayment.id} already has status ${eventData.newStatus}. Skipping duplicate update.`
        );
        return;
      }

      // Update payment status
      const result = await this.prisma.paymentBlockchain.update({
        where: {
          id: existingPayment.id,
        },
        data: {
          status: eventData.newStatus,
          blockNumber: eventData.blockNumber,
          txHash: eventData.transactionHash,
          updatedAt: new Date(),
        },
      });

      logger.success(
        `Payment status updated: ${existingPayment.id} -> ${eventData.newStatus}`
      );
    } catch (error: any) {
      logger.error("❌ Error handling PaymentStatusChanged event:", {
        error: error.message,
        stack: error.stack,
        eventData: {
          id: eventData.id,
          orderID: eventData.orderID,
          oldStatus: eventData.oldStatus,
          newStatus: eventData.newStatus,
          timestamp: eventData.timestamp,
        },
      });
      throw error;
    }
  }

  /**
   * Handle PaymentFailed event
   * Note: method is set when payment fails (from failedPayment function)
   *
   * IMPORTANT: Handles redundancy between worker and event listener
   */
  async handlePaymentFailed(eventData: {
    id: string;
    orderID: string;
    method: string;
    amount: number;
    timestamp: number;
    blockNumber: number;
    transactionHash: string;
  }): Promise<void> {
    logger.info(`Processing PaymentFailed event:`, {
      id: eventData.id,
      orderID: eventData.orderID,
      method: eventData.method,
      amount: eventData.amount,
      isIdHash: this.isBytes32Hash(eventData.id),
    });

    try {
      // If ID is a bytes32 hash, try to find by txHash
      let existingPayment;
      if (this.isBytes32Hash(eventData.id)) {
        existingPayment = await this.prisma.paymentBlockchain.findFirst({
          where: { txHash: eventData.transactionHash },
        });

        if (!existingPayment) {
          logger.warn(
            `⚠️ PaymentFailed event has bytes32 hash ID and no matching record found. Skipping.`
          );
          return;
        }
      } else {
        existingPayment = await this.prisma.paymentBlockchain.findUnique({
          where: { id: eventData.id },
        });
      }

      if (!existingPayment) {
        logger.warn(
          `⚠️ Payment not found in database: ${eventData.id}. Skipping failed update.`
        );
        return; // Gracefully skip this event
      }

      // Update payment with method (paidAt remains null for failed payments)
      const result = await this.prisma.paymentBlockchain.update({
        where: {
          id: existingPayment.id,
        },
        data: {
          method: eventData.method,
          blockNumber: eventData.blockNumber,
          txHash: eventData.transactionHash,
          updatedAt: new Date(),
        },
      });

      logger.success(`Payment marked as failed: ${existingPayment.id} (method: ${eventData.method})`);
    } catch (error: any) {
      logger.error("❌ Error handling PaymentFailed event:", {
        error: error.message,
        stack: error.stack,
        eventData: {
          id: eventData.id,
          orderID: eventData.orderID,
          method: eventData.method,
          amount: eventData.amount,
          timestamp: eventData.timestamp,
        },
      });
      throw error;
    }
  }

  /**
   * Handle PaymentCompleted event
   * Note: method is set when payment is completed (from completePayment function)
   *
   * IMPORTANT: Handles redundancy between worker and event listener
   */
  async handlePaymentCompleted(eventData: {
    id: string;
    orderID: string;
    method: string;
    amount: number;
    timestamp: number;
    blockNumber: number;
    transactionHash: string;
  }): Promise<void> {
    logger.info(`Processing PaymentCompleted event:`, {
      id: eventData.id,
      orderID: eventData.orderID,
      method: eventData.method,
      amount: eventData.amount,
      isIdHash: this.isBytes32Hash(eventData.id),
    });

    try {
      // If ID is a bytes32 hash, try to find by txHash
      let existingPayment;
      if (this.isBytes32Hash(eventData.id)) {
        existingPayment = await this.prisma.paymentBlockchain.findFirst({
          where: { txHash: eventData.transactionHash },
        });

        if (!existingPayment) {
          logger.warn(
            `⚠️ PaymentCompleted event has bytes32 hash ID and no matching record found. Skipping.`
          );
          return;
        }
      } else {
        existingPayment = await this.prisma.paymentBlockchain.findUnique({
          where: { id: eventData.id },
        });
      }

      if (!existingPayment) {
        logger.warn(
          `⚠️ Payment not found in database: ${eventData.id}. Skipping completion update.`
        );
        return; // Gracefully skip this event
      }

      // Check if payment is already completed (paidAt is set)
      if (existingPayment.paidAt !== null) {
        logger.info(
          `ℹ️ Payment ${existingPayment.id} is already marked as completed. Skipping duplicate update.`
        );
        return;
      }

      // Update payment with method and paidAt timestamp
      const result = await this.prisma.paymentBlockchain.update({
        where: {
          id: existingPayment.id,
        },
        data: {
          method: eventData.method,
          paidAt: BigInt(Math.floor(eventData.timestamp)),
          blockNumber: eventData.blockNumber,
          txHash: eventData.transactionHash,
          updatedAt: new Date(),
        },
      });

      logger.success(`Payment completed: ${existingPayment.id} (method: ${eventData.method})`);
    } catch (error: any) {
      logger.error("❌ Error handling PaymentCompleted event:", {
        error: error.message,
        stack: error.stack,
        eventData: {
          id: eventData.id,
          orderID: eventData.orderID,
          method: eventData.method,
          amount: eventData.amount,
          timestamp: eventData.timestamp,
        },
      });
      throw error;
    }
  }
}

export default PaymentEventProcessor;
