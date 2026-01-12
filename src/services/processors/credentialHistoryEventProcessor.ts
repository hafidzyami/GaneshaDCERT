import { PrismaClient } from "@prisma/client";
import logger from "../../config/logger";

/**
 * Credential History Event Processor
 * Handles blockchain events from CredentialsHistoryManager contract
 * Note: Event enrichment is done in credentialsHistoryEventPublisher
 */
class CredentialHistoryEventProcessor {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Handle CredentialHistoryCreated event
   */
  async handleCredentialHistoryCreated(eventData: {
    id: string;
    issuerDID: string;
    holderDID: string;
    historyType: string;
    status: number;
    vcID: string;
    newVCID: string;
    blockNumber: number;
    transactionHash: string;
  }): Promise<void> {
    logger.info(`Processing CredentialHistoryCreated event:`, {
      id: eventData.id,
      issuerDID: eventData.issuerDID,
      holderDID: eventData.holderDID,
      historyType: eventData.historyType,
      status: eventData.status,
      vcID: eventData.vcID,
      newVCID: eventData.newVCID,
    });

    try {
      // Map status number to enum
      const statusMap: {
        [key: number]: "NONE" | "INITIATED" | "PENDING" | "APPROVED" | "REJECTED";
      } = {
        0: "NONE",
        1: "INITIATED",
        2: "PENDING",
        3: "APPROVED",
        4: "REJECTED",
      };

      const status = statusMap[eventData.status] || "NONE";

      // Upsert credential history to database
      const result = await this.prisma.credentialHistoryBlockchain.upsert({
        where: {
          id: eventData.id,
        },
        create: {
          id: eventData.id,
          issuerDID: eventData.issuerDID,
          holderDID: eventData.holderDID,
          historyType: eventData.historyType,
          status: status,
          vcID: eventData.vcID,
          newVCID: eventData.newVCID || null,
          blockNumber: eventData.blockNumber,
          txHash: eventData.transactionHash,
        },
        update: {
          issuerDID: eventData.issuerDID,
          holderDID: eventData.holderDID,
          historyType: eventData.historyType,
          status: status,
          vcID: eventData.vcID,
          newVCID: eventData.newVCID || null,
          blockNumber: eventData.blockNumber,
          txHash: eventData.transactionHash,
          updatedAt: new Date(),
        },
      });

      logger.success(
        `Credential history upserted in database: ${eventData.id} (status: ${status})`
      );
    } catch (error: any) {
      logger.error("❌ Error handling CredentialHistoryCreated event:", {
        error: error.message,
        stack: error.stack,
        eventData: eventData,
      });
      throw error;
    }
  }

  /**
   * Handle CredentialHistoryStatusChanged event
   */
  async handleCredentialHistoryStatusChanged(eventData: {
    id: string;
    oldStatus: number;
    newStatus: number;
    blockNumber: number;
    transactionHash: string;
  }): Promise<void> {
    logger.info(`Processing CredentialHistoryStatusChanged event:`, {
      id: eventData.id,
      oldStatus: eventData.oldStatus,
      newStatus: eventData.newStatus,
    });

    try {
      // Map status number to enum
      const statusMap: {
        [key: number]: "NONE" | "INITIATED" | "PENDING" | "APPROVED" | "REJECTED";
      } = {
        0: "NONE",
        1: "INITIATED",
        2: "PENDING",
        3: "APPROVED",
        4: "REJECTED",
      };

      const newStatus = statusMap[eventData.newStatus] || "NONE";

      // Update status
      const result = await this.prisma.credentialHistoryBlockchain.update({
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
        `Credential history status updated: ${eventData.id} -> ${newStatus}`
      );
    } catch (error: any) {
      logger.error("❌ Error handling CredentialHistoryStatusChanged event:", {
        error: error.message,
        stack: error.stack,
        eventData: eventData,
      });
      throw error;
    }
  }

  /**
   * Handle CredentialHistoryApproved event
   */
  async handleCredentialHistoryApproved(eventData: {
    id: string;
    issuerDID: string;
    holderDID: string;
    blockNumber: number;
    transactionHash: string;
  }): Promise<void> {
    logger.info(`Processing CredentialHistoryApproved event:`, {
      id: eventData.id,
      issuerDID: eventData.issuerDID,
      holderDID: eventData.holderDID,
    });

    try {
      // Update status to APPROVED
      const result = await this.prisma.credentialHistoryBlockchain.update({
        where: {
          id: eventData.id,
        },
        data: {
          status: "APPROVED",
          blockNumber: eventData.blockNumber,
          txHash: eventData.transactionHash,
          updatedAt: new Date(),
        },
      });

      logger.success(`Credential history approved: ${eventData.id}`);
    } catch (error: any) {
      logger.error("❌ Error handling CredentialHistoryApproved event:", {
        error: error.message,
        stack: error.stack,
        eventData: eventData,
      });
      throw error;
    }
  }

  /**
   * Handle CredentialHistoryRejected event
   */
  async handleCredentialHistoryRejected(eventData: {
    id: string;
    issuerDID: string;
    holderDID: string;
    blockNumber: number;
    transactionHash: string;
  }): Promise<void> {
    logger.info(`Processing CredentialHistoryRejected event:`, {
      id: eventData.id,
      issuerDID: eventData.issuerDID,
      holderDID: eventData.holderDID,
    });

    try {
      // Update status to REJECTED
      const result = await this.prisma.credentialHistoryBlockchain.update({
        where: {
          id: eventData.id,
        },
        data: {
          status: "REJECTED",
          blockNumber: eventData.blockNumber,
          txHash: eventData.transactionHash,
          updatedAt: new Date(),
        },
      });

      logger.success(`Credential history rejected: ${eventData.id}`);
    } catch (error: any) {
      logger.error("❌ Error handling CredentialHistoryRejected event:", {
        error: error.message,
        stack: error.stack,
        eventData: eventData,
      });
      throw error;
    }
  }
}

export default CredentialHistoryEventProcessor;
