import { PrismaClient } from "@prisma/client";
import logger from "../../config/logger";
import { CredentialService } from "../credential.service";

/**
 * Payment Event Processor
 * Handles blockchain events from PaymentManager contract
 */
class PaymentEventProcessor {
  private prisma: PrismaClient;
  private credentialService: CredentialService;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.credentialService = new CredentialService({ db: prisma });
  }

  /**
   * Handle OrderCreated event
   */
  async handleOrderCreated(eventData: {
    id: string;
    holderDID: string;
    status: number;
    amount: bigint;
    currency: string;
    timestamp: bigint;
    blockNumber: bigint;
    transactionHash: string;
  }): Promise<void> {
    logger.info(`Processing OrderCreated event:`, {
      id: eventData.id,
      holderDID: eventData.holderDID,
      status: eventData.status,
      amount: eventData.amount.toString(),
      currency: eventData.currency,
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
          holderDID: eventData.holderDID,
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
          ...eventData,
          amount: eventData.amount.toString(),
          timestamp: eventData.timestamp.toString(),
        },
      });
      throw error;
    }
  }

  /**
   * Handle OrderStatusChanged event
   */
  async handleOrderStatusChanged(eventData: {
    id: string;
    oldStatus: number;
    newStatus: number;
    timestamp: bigint;
    blockNumber: bigint;
    transactionHash: string;
  }): Promise<void> {
    logger.info(`Processing OrderStatusChanged event:`, {
      id: eventData.id,
      oldStatus: eventData.oldStatus,
      newStatus: eventData.newStatus,
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

      // Update order status
      const result = await this.prisma.orderBlockchain.update({
        where: {
          id: eventData.id,
        },
        data: {
          status: newStatus,
          blockNumber: eventData.blockNumber,
          txHash: eventData.transactionHash,
          updatedAt: new Date(),
        },
      });

      logger.success(
        `Order status updated: ${eventData.id} -> ${newStatus}`
      );
    } catch (error: any) {
      logger.error("❌ Error handling OrderStatusChanged event:", {
        error: error.message,
        stack: error.stack,
        eventData: {
          ...eventData,
          timestamp: eventData.timestamp.toString(),
        },
      });
      throw error;
    }
  }

  /**
   * Handle ItemCreated event
   */
  async handleItemCreated(eventData: {
    id: string;
    vcID: string;
    vcHash: string;
    price: bigint;
    itemType: number;
    timestamp: bigint;
    blockNumber: bigint;
    transactionHash: string;
  }): Promise<void> {
    logger.info(`Processing ItemCreated event:`, {
      id: eventData.id,
      vcID: eventData.vcID,
      vcHash: eventData.vcHash,
      price: eventData.price.toString(),
      itemType: eventData.itemType,
    });

    try {
      // Map itemType number to enum
      const itemTypeMap: {
        [key: number]: "ISSUANCE" | "RENEWAL" | "UPDATE";
      } = {
        0: "ISSUANCE",
        1: "RENEWAL",
        2: "UPDATE",
      };

      const itemType = itemTypeMap[eventData.itemType] || "ISSUANCE";

      // Upsert item to database
      const result = await this.prisma.itemBlockchain.upsert({
        where: {
          id: eventData.id,
        },
        create: {
          id: eventData.id,
          price: eventData.price,
          vcID: eventData.vcID,
          vcHash: eventData.vcHash,
          itemType: itemType,
          isPaid: false,
          blockNumber: eventData.blockNumber,
          txHash: eventData.transactionHash,
        },
        update: {
          price: eventData.price,
          vcID: eventData.vcID,
          vcHash: eventData.vcHash,
          itemType: itemType,
          blockNumber: eventData.blockNumber,
          txHash: eventData.transactionHash,
          updatedAt: new Date(),
        },
      });

      logger.success(
        `Item upserted in database: ${eventData.id} (type: ${itemType})`
      );
    } catch (error: any) {
      logger.error("❌ Error handling ItemCreated event:", {
        error: error.message,
        stack: error.stack,
        eventData: {
          ...eventData,
          price: eventData.price.toString(),
          timestamp: eventData.timestamp.toString(),
        },
      });
      throw error;
    }
  }

  /**
   * Handle ItemPaid event
   * Triggers automatic VC issuance/renewal/update after payment completion
   */
  async handleItemPaid(eventData: {
    id: string;
    vcID: string;
    timestamp: bigint;
    blockNumber: bigint;
    transactionHash: string;
  }): Promise<void> {
    logger.info(`Processing ItemPaid event:`, {
      id: eventData.id,
      vcID: eventData.vcID,
    });

    try {
      // 1. Update item isPaid status
      const result = await this.prisma.itemBlockchain.update({
        where: {
          id: eventData.id,
        },
        data: {
          isPaid: true,
          blockNumber: eventData.blockNumber,
          txHash: eventData.transactionHash,
          updatedAt: new Date(),
        },
      });

      logger.success(`✅ Item marked as paid: ${eventData.id}`);

      // 2. Get full item details including type and vcHash
      const item = await this.prisma.itemBlockchain.findUnique({
        where: { id: eventData.id },
      });

      if (!item) {
        logger.error(`❌ Item not found after update: ${eventData.id}`);
        return;
      }

      logger.info(`Item details:`, {
        itemType: item.itemType,
        vcID: item.vcID,
        vcHash: item.vcHash,
      });

      // 3. Trigger appropriate credential operation based on itemType
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
              `⚠️ Unknown itemType: ${item.itemType} for item ${eventData.id}`
            );
        }
      } catch (credentialError: any) {
        logger.error(
          `❌ Failed to complete credential operation for item ${eventData.id}:`,
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
    } catch (error: any) {
      logger.error("❌ Error handling ItemPaid event:", {
        error: error.message,
        stack: error.stack,
        eventData: {
          ...eventData,
          timestamp: eventData.timestamp.toString(),
        },
      });
      throw error;
    }
  }

  /**
   * Handle PaymentCreated event
   */
  async handlePaymentCreated(eventData: {
    id: string;
    orderID: string;
    method: string;
    status: string;
    amount: bigint;
    timestamp: bigint;
    blockNumber: bigint;
    transactionHash: string;
  }): Promise<void> {
    logger.info(`Processing PaymentCreated event:`, {
      id: eventData.id,
      orderID: eventData.orderID,
      method: eventData.method,
      status: eventData.status,
      amount: eventData.amount.toString(),
    });

    try {
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
        update: {
          orderID: eventData.orderID,
          method: eventData.method,
          status: eventData.status,
          amount: eventData.amount,
          blockNumber: eventData.blockNumber,
          txHash: eventData.transactionHash,
          updatedAt: new Date(),
        },
      });

      logger.success(
        `Payment upserted in database: ${eventData.id} (status: ${eventData.status})`
      );
    } catch (error: any) {
      logger.error("❌ Error handling PaymentCreated event:", {
        error: error.message,
        stack: error.stack,
        eventData: {
          ...eventData,
          amount: eventData.amount.toString(),
          timestamp: eventData.timestamp.toString(),
        },
      });
      throw error;
    }
  }

  /**
   * Handle PaymentStatusChanged event
   */
  async handlePaymentStatusChanged(eventData: {
    id: string;
    orderID: string;
    oldStatus: string;
    newStatus: string;
    timestamp: bigint;
    blockNumber: bigint;
    transactionHash: string;
  }): Promise<void> {
    logger.info(`Processing PaymentStatusChanged event:`, {
      id: eventData.id,
      orderID: eventData.orderID,
      oldStatus: eventData.oldStatus,
      newStatus: eventData.newStatus,
    });

    try {
      // Update payment status
      const result = await this.prisma.paymentBlockchain.update({
        where: {
          id: eventData.id,
        },
        data: {
          status: eventData.newStatus,
          blockNumber: eventData.blockNumber,
          txHash: eventData.transactionHash,
          updatedAt: new Date(),
        },
      });

      logger.success(
        `Payment status updated: ${eventData.id} -> ${eventData.newStatus}`
      );
    } catch (error: any) {
      logger.error("❌ Error handling PaymentStatusChanged event:", {
        error: error.message,
        stack: error.stack,
        eventData: {
          ...eventData,
          timestamp: eventData.timestamp.toString(),
        },
      });
      throw error;
    }
  }

  /**
   * Handle PaymentCompleted event
   */
  async handlePaymentCompleted(eventData: {
    id: string;
    orderID: string;
    amount: bigint;
    timestamp: bigint;
    blockNumber: bigint;
    transactionHash: string;
  }): Promise<void> {
    logger.info(`Processing PaymentCompleted event:`, {
      id: eventData.id,
      orderID: eventData.orderID,
      amount: eventData.amount.toString(),
    });

    try {
      // Update payment with paidAt timestamp
      const result = await this.prisma.paymentBlockchain.update({
        where: {
          id: eventData.id,
        },
        data: {
          paidAt: eventData.timestamp,
          blockNumber: eventData.blockNumber,
          txHash: eventData.transactionHash,
          updatedAt: new Date(),
        },
      });

      logger.success(`Payment completed: ${eventData.id}`);
    } catch (error: any) {
      logger.error("❌ Error handling PaymentCompleted event:", {
        error: error.message,
        stack: error.stack,
        eventData: {
          ...eventData,
          amount: eventData.amount.toString(),
          timestamp: eventData.timestamp.toString(),
        },
      });
      throw error;
    }
  }
}

export default PaymentEventProcessor;
