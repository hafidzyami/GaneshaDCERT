import { PrismaClient } from "@prisma/client";
import logger from "../../config/logger";

/**
 * Check if a string is a keccak256 hash (0x + 64 hex characters)
 * Indexed strings in Solidity are hashed with keccak256
 */
function isKeccak256Hash(value: string): boolean {
  if (!value || typeof value !== 'string') return false;
  // keccak256 hash format: 0x + 64 hex characters = 66 total length
  return /^0x[a-fA-F0-9]{64}$/.test(value);
}

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

    // Validate that critical fields are not keccak256 hashes
    if (isKeccak256Hash(eventData.id)) {
      const errorMsg = `CRITICAL: Cannot save credential history - id is still a keccak256 hash: ${eventData.id}. Enrichment failed.`;
      logger.error(errorMsg);
      throw new Error(errorMsg);
    }

    if (isKeccak256Hash(eventData.issuerDID)) {
      const errorMsg = `CRITICAL: Cannot save credential history - issuerDID is still a keccak256 hash: ${eventData.issuerDID}. Enrichment failed.`;
      logger.error(errorMsg);
      throw new Error(errorMsg);
    }

    if (isKeccak256Hash(eventData.holderDID)) {
      const errorMsg = `CRITICAL: Cannot save credential history - holderDID is still a keccak256 hash: ${eventData.holderDID}. Enrichment failed.`;
      logger.error(errorMsg);
      throw new Error(errorMsg);
    }

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

    // Validate that id is not a keccak256 hash
    if (isKeccak256Hash(eventData.id)) {
      const errorMsg = `CRITICAL: Cannot update credential history status - id is still a keccak256 hash: ${eventData.id}. Enrichment failed.`;
      logger.error(errorMsg);
      throw new Error(errorMsg);
    }

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

    // Validate that id is not a keccak256 hash
    if (isKeccak256Hash(eventData.id)) {
      const errorMsg = `CRITICAL: Cannot approve credential history - id is still a keccak256 hash: ${eventData.id}. Enrichment failed.`;
      logger.error(errorMsg);
      throw new Error(errorMsg);
    }

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

    // Validate that id is not a keccak256 hash
    if (isKeccak256Hash(eventData.id)) {
      const errorMsg = `CRITICAL: Cannot reject credential history - id is still a keccak256 hash: ${eventData.id}. Enrichment failed.`;
      logger.error(errorMsg);
      throw new Error(errorMsg);
    }

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
