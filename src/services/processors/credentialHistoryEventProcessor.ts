import { PrismaClient } from "@prisma/client";
import logger from "../../config/logger";
import DIDBlockchainService from "../blockchain/didBlockchain.service";

/**
 * Credential History Event Processor
 * Handles blockchain events from CredentialsHistoryManager contract
 */
class CredentialHistoryEventProcessor {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Helper: Convert indexed parameter to string
   */
  private enrichIndexedString(value: any): string {
    if (typeof value === "string") {
      return value;
    }
    if (typeof value === "object" && value !== null) {
      // If it's an indexed parameter object, try to get the actual value
      return value.toString();
    }
    return String(value);
  }

  /**
   * Helper: Fetch DID name from blockchain
   */
  private async fetchDIDName(did: string): Promise<string | null> {
    try {
      const didDocument = await DIDBlockchainService.getDIDDocument(did);
      if (didDocument.found && didDocument.details?.name) {
        return didDocument.details.name;
      }
      return null;
    } catch (error) {
      logger.warn(`Failed to fetch DID name for ${did}:`, error);
      return null;
    }
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
    blockNumber: bigint;
    transactionHash: string;
  }): Promise<void> {
    // Enrich indexed parameters
    const enrichedId = this.enrichIndexedString(eventData.id);
    const enrichedIssuerDID = this.enrichIndexedString(eventData.issuerDID);
    const enrichedHolderDID = this.enrichIndexedString(eventData.holderDID);
    const enrichedHistoryType = this.enrichIndexedString(eventData.historyType);
    const enrichedVcID = this.enrichIndexedString(eventData.vcID);
    const enrichedNewVCID = eventData.newVCID
      ? this.enrichIndexedString(eventData.newVCID)
      : null;

    logger.info(`Processing CredentialHistoryCreated event:`, {
      id: enrichedId,
      issuerDID: enrichedIssuerDID,
      holderDID: enrichedHolderDID,
      historyType: enrichedHistoryType,
      status: eventData.status,
      vcID: enrichedVcID,
      newVCID: enrichedNewVCID,
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
          id: enrichedId,
        },
        create: {
          id: enrichedId,
          issuerDID: enrichedIssuerDID,
          holderDID: enrichedHolderDID,
          historyType: enrichedHistoryType,
          status: status,
          vcID: enrichedVcID,
          newVCID: enrichedNewVCID,
          blockNumber: eventData.blockNumber,
          txHash: eventData.transactionHash,
        },
        update: {
          issuerDID: enrichedIssuerDID,
          holderDID: enrichedHolderDID,
          historyType: enrichedHistoryType,
          status: status,
          vcID: enrichedVcID,
          newVCID: enrichedNewVCID,
          blockNumber: eventData.blockNumber,
          txHash: eventData.transactionHash,
          updatedAt: new Date(),
        },
      });

      logger.success(
        `Credential history upserted in database: ${enrichedId} (status: ${status})`
      );
    } catch (error: any) {
      logger.error("❌ Error handling CredentialHistoryCreated event:", {
        error: error.message,
        stack: error.stack,
        eventData: {
          id: enrichedId,
          issuerDID: enrichedIssuerDID,
          holderDID: enrichedHolderDID,
          historyType: enrichedHistoryType,
          vcID: enrichedVcID,
        },
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
    blockNumber: bigint;
    transactionHash: string;
  }): Promise<void> {
    // Enrich indexed parameters
    const enrichedId = this.enrichIndexedString(eventData.id);

    logger.info(`Processing CredentialHistoryStatusChanged event:`, {
      id: enrichedId,
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
          id: enrichedId,
        },
        data: {
          status: newStatus,
          blockNumber: eventData.blockNumber,
          txHash: eventData.transactionHash,
          updatedAt: new Date(),
        },
      });

      logger.success(
        `Credential history status updated: ${enrichedId} -> ${newStatus}`
      );
    } catch (error: any) {
      logger.error("❌ Error handling CredentialHistoryStatusChanged event:", {
        error: error.message,
        stack: error.stack,
        eventData: {
          id: enrichedId,
        },
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
    blockNumber: bigint;
    transactionHash: string;
  }): Promise<void> {
    // Enrich indexed parameters
    const enrichedId = this.enrichIndexedString(eventData.id);
    const enrichedIssuerDID = this.enrichIndexedString(eventData.issuerDID);
    const enrichedHolderDID = this.enrichIndexedString(eventData.holderDID);

    logger.info(`Processing CredentialHistoryApproved event:`, {
      id: enrichedId,
      issuerDID: enrichedIssuerDID,
      holderDID: enrichedHolderDID,
    });

    try {
      // Update status to APPROVED
      const result = await this.prisma.credentialHistoryBlockchain.update({
        where: {
          id: enrichedId,
        },
        data: {
          status: "APPROVED",
          blockNumber: eventData.blockNumber,
          txHash: eventData.transactionHash,
          updatedAt: new Date(),
        },
      });

      logger.success(`Credential history approved: ${enrichedId}`);
    } catch (error: any) {
      logger.error("❌ Error handling CredentialHistoryApproved event:", {
        error: error.message,
        stack: error.stack,
        eventData: {
          id: enrichedId,
          issuerDID: enrichedIssuerDID,
          holderDID: enrichedHolderDID,
        },
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
    blockNumber: bigint;
    transactionHash: string;
  }): Promise<void> {
    // Enrich indexed parameters
    const enrichedId = this.enrichIndexedString(eventData.id);
    const enrichedIssuerDID = this.enrichIndexedString(eventData.issuerDID);
    const enrichedHolderDID = this.enrichIndexedString(eventData.holderDID);

    logger.info(`Processing CredentialHistoryRejected event:`, {
      id: enrichedId,
      issuerDID: enrichedIssuerDID,
      holderDID: enrichedHolderDID,
    });

    try {
      // Update status to REJECTED
      const result = await this.prisma.credentialHistoryBlockchain.update({
        where: {
          id: enrichedId,
        },
        data: {
          status: "REJECTED",
          blockNumber: eventData.blockNumber,
          txHash: eventData.transactionHash,
          updatedAt: new Date(),
        },
      });

      logger.success(`Credential history rejected: ${enrichedId}`);
    } catch (error: any) {
      logger.error("❌ Error handling CredentialHistoryRejected event:", {
        error: error.message,
        stack: error.stack,
        eventData: {
          id: enrichedId,
          issuerDID: enrichedIssuerDID,
          holderDID: enrichedHolderDID,
        },
      });
      throw error;
    }
  }
}

export default CredentialHistoryEventProcessor;
