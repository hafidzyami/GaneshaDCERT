import { ethers } from "ethers";
import CredentialsHistoryBlockchainConfig from "../config/credentialsHistoryBlockchain";
import { prisma } from "../config/database";
import logger from "../config/logger";
import CredentialHistoryEventProcessor from "./processors/credentialHistoryEventProcessor";

/**
 * CredentialsHistory Blockchain Event Publisher
 * Listens to events from CredentialsHistoryManager contract and syncs to database
 */
class CredentialsHistoryEventPublisher {
  private contract: ethers.Contract;
  private contractAddress: string;
  private processor: CredentialHistoryEventProcessor;
  private isRunning: boolean = false;
  private lastProcessedBlock: { [eventType: string]: bigint } = {};

  // Event types to listen for
  private eventTypes = [
    "CredentialHistoryCreated",
    "CredentialHistoryStatusChanged",
    "CredentialHistoryApproved",
    "CredentialHistoryRejected",
  ];

  constructor() {
    this.contract = CredentialsHistoryBlockchainConfig.contract;
    this.contractAddress =
      CredentialsHistoryBlockchainConfig.contract.target as string;
    this.processor = new CredentialHistoryEventProcessor(prisma);
  }

  /**
   * Start listening to blockchain events
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn(
        "[CredentialsHistory] Event publisher is already running"
      );
      return;
    }

    try {
      logger.info("[CredentialsHistory] Starting event publisher...");

      // Load checkpoints from database
      await this.loadCheckpoints();

      // Catch up with historical events
      await this.catchUpHistoricalEvents();

      // Start listening to real-time events
      this.listenToRealtimeEvents();

      this.isRunning = true;
      logger.success(
        "[CredentialsHistory] Event publisher started successfully"
      );
    } catch (error) {
      logger.error("[CredentialsHistory] Failed to start event publisher:", error);
      throw error;
    }
  }

  /**
   * Stop listening to blockchain events
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    logger.info("[CredentialsHistory] Stopping event publisher...");
    this.contract.removeAllListeners();
    this.isRunning = false;
    logger.success("[CredentialsHistory] Event publisher stopped");
  }

  /**
   * Load checkpoints from database
   */
  private async loadCheckpoints(): Promise<void> {
    try {
      const checkpoints = await prisma.eventCheckpoint.findMany({
        where: {
          contractAddress: this.contractAddress,
        },
      });

      for (const checkpoint of checkpoints) {
        this.lastProcessedBlock[checkpoint.eventType] =
          checkpoint.lastSyncedBlock;
      }

      logger.info(
        `[CredentialsHistory] Loaded ${checkpoints.length} checkpoints`
      );
    } catch (error) {
      logger.error("[CredentialsHistory] Error loading checkpoints:", error);
    }
  }

  /**
   * Update checkpoint in database
   */
  private async updateCheckpoint(
    eventType: string,
    blockNumber: bigint
  ): Promise<void> {
    try {
      await prisma.eventCheckpoint.upsert({
        where: {
          contractAddress_eventType: {
            contractAddress: this.contractAddress,
            eventType: eventType,
          },
        },
        create: {
          contractAddress: this.contractAddress,
          eventType: eventType,
          lastSyncedBlock: blockNumber,
          lastSyncedAt: new Date(),
        },
        update: {
          lastSyncedBlock: blockNumber,
          lastSyncedAt: new Date(),
        },
      });

      this.lastProcessedBlock[eventType] = blockNumber;
    } catch (error) {
      logger.error(
        `[CredentialsHistory] Error updating checkpoint for ${eventType}:`,
        error
      );
    }
  }

  /**
   * Check if event has been processed (idempotency)
   */
  private async isEventProcessed(
    transactionHash: string,
    logIndex: number
  ): Promise<boolean> {
    try {
      const existing = await prisma.processedEvent.findUnique({
        where: {
          transactionHash_logIndex: {
            transactionHash,
            logIndex,
          },
        },
      });

      return !!existing;
    } catch (error) {
      logger.error("[CredentialsHistory] Error checking processed event:", error);
      return false;
    }
  }

  /**
   * Mark event as processed
   */
  private async markEventAsProcessed(
    transactionHash: string,
    logIndex: number,
    eventType: string,
    blockNumber: bigint
  ): Promise<void> {
    try {
      await prisma.processedEvent.create({
        data: {
          transactionHash,
          logIndex,
          eventType,
          contractAddress: this.contractAddress,
          blockNumber,
        },
      });
    } catch (error) {
      logger.error("[CredentialsHistory] Error marking event as processed:", error);
    }
  }

  /**
   * Catch up with historical events
   */
  private async catchUpHistoricalEvents(): Promise<void> {
    try {
      const currentBlock =
        await CredentialsHistoryBlockchainConfig.provider.getBlockNumber();
      logger.info(
        `[CredentialsHistory] Current blockchain block: ${currentBlock}`
      );

      for (const eventType of this.eventTypes) {
        const lastProcessed = this.lastProcessedBlock[eventType] || BigInt(0);
        const fromBlock = Number(lastProcessed) + 1;

        if (fromBlock > currentBlock) {
          logger.info(
            `[CredentialsHistory] ${eventType}: Already synced (block ${lastProcessed})`
          );
          continue;
        }

        logger.info(
          `[CredentialsHistory] Catching up ${eventType} from block ${fromBlock} to ${currentBlock}`
        );

        const filter = this.contract.filters[eventType]();
        const events = await this.contract.queryFilter(
          filter,
          fromBlock,
          currentBlock
        );

        logger.info(
          `[CredentialsHistory] Found ${events.length} ${eventType} events`
        );

        for (const event of events) {
          await this.processEvent(eventType, event as ethers.EventLog);
        }

        await this.updateCheckpoint(eventType, BigInt(currentBlock));
      }

      logger.success(
        "[CredentialsHistory] Historical events catch-up completed"
      );
    } catch (error) {
      logger.error("[CredentialsHistory] Error catching up historical events:", error);
      throw error;
    }
  }

  /**
   * Listen to real-time events
   */
  private listenToRealtimeEvents(): void {
    logger.info("[CredentialsHistory] Starting real-time event listeners...");

    this.contract.on("CredentialHistoryCreated", async (id, issuerDID, holderDID, historyType, status, vcID, newVCID, event) => {
      try {
        const eventLog = event.log as ethers.EventLog;
        await this.processEvent("CredentialHistoryCreated", eventLog);
      } catch (error) {
        logger.error("[CredentialsHistory] Error processing CredentialHistoryCreated:", error);
      }
    });

    this.contract.on("CredentialHistoryStatusChanged", async (id, oldStatus, newStatus, event) => {
      try {
        const eventLog = event.log as ethers.EventLog;
        await this.processEvent("CredentialHistoryStatusChanged", eventLog);
      } catch (error) {
        logger.error("[CredentialsHistory] Error processing CredentialHistoryStatusChanged:", error);
      }
    });

    this.contract.on("CredentialHistoryApproved", async (id, issuerDID, holderDID, event) => {
      try {
        const eventLog = event.log as ethers.EventLog;
        await this.processEvent("CredentialHistoryApproved", eventLog);
      } catch (error) {
        logger.error("[CredentialsHistory] Error processing CredentialHistoryApproved:", error);
      }
    });

    this.contract.on("CredentialHistoryRejected", async (id, issuerDID, holderDID, event) => {
      try {
        const eventLog = event.log as ethers.EventLog;
        await this.processEvent("CredentialHistoryRejected", eventLog);
      } catch (error) {
        logger.error("[CredentialsHistory] Error processing CredentialHistoryRejected:", error);
      }
    });

    logger.success(
      "[CredentialsHistory] Real-time event listeners started"
    );
  }

  /**
   * Process a single event
   */
  private async processEvent(
    eventType: string,
    event: ethers.EventLog
  ): Promise<void> {
    // Check idempotency
    const alreadyProcessed = await this.isEventProcessed(
      event.transactionHash,
      event.index
    );

    if (alreadyProcessed) {
      logger.debug(
        `[CredentialsHistory] Event already processed: ${eventType} ${event.transactionHash}:${event.index}`
      );
      return;
    }

    try {
      // Extract event data
      const eventData = this.extractEventData(eventType, event);

      // Route to processor
      await this.routeToProcessor(eventType, eventData);

      // Mark as processed
      await this.markEventAsProcessed(
        event.transactionHash,
        event.index,
        eventType,
        BigInt(event.blockNumber)
      );

      // Update checkpoint
      await this.updateCheckpoint(eventType, BigInt(event.blockNumber));

      logger.success(
        `[CredentialsHistory] Processed ${eventType} at block ${event.blockNumber}`
      );
    } catch (error) {
      logger.error(
        `[CredentialsHistory] Error processing ${eventType}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Extract event data based on event type
   */
  private extractEventData(eventType: string, event: ethers.EventLog): any {
    const baseData = {
      blockNumber: BigInt(event.blockNumber),
      transactionHash: event.transactionHash,
    };

    switch (eventType) {
      case "CredentialHistoryCreated":
        return {
          id: String(event.args[0]),
          issuerDID: String(event.args[1]),
          holderDID: String(event.args[2]),
          historyType: String(event.args[3]),
          status: Number(event.args[4]),
          vcID: String(event.args[5]),
          newVCID: String(event.args[6]),
          ...baseData,
        };

      case "CredentialHistoryStatusChanged":
        return {
          id: String(event.args[0]),
          oldStatus: Number(event.args[1]),
          newStatus: Number(event.args[2]),
          ...baseData,
        };

      case "CredentialHistoryApproved":
        return {
          id: String(event.args[0]),
          issuerDID: String(event.args[1]),
          holderDID: String(event.args[2]),
          ...baseData,
        };

      case "CredentialHistoryRejected":
        return {
          id: String(event.args[0]),
          issuerDID: String(event.args[1]),
          holderDID: String(event.args[2]),
          ...baseData,
        };

      default:
        logger.warn(`[CredentialsHistory] Unknown event type: ${eventType}`);
        return baseData;
    }
  }

  /**
   * Route event to appropriate processor handler
   */
  private async routeToProcessor(eventType: string, eventData: any): Promise<void> {
    switch (eventType) {
      case "CredentialHistoryCreated":
        await this.processor.handleCredentialHistoryCreated(eventData);
        break;

      case "CredentialHistoryStatusChanged":
        await this.processor.handleCredentialHistoryStatusChanged(eventData);
        break;

      case "CredentialHistoryApproved":
        await this.processor.handleCredentialHistoryApproved(eventData);
        break;

      case "CredentialHistoryRejected":
        await this.processor.handleCredentialHistoryRejected(eventData);
        break;

      default:
        logger.warn(
          `[CredentialsHistory] No handler for event type: ${eventType}`
        );
    }
  }

  /**
   * Get sync status for monitoring
   */
  async getSyncStatus(): Promise<any> {
    const currentBlock =
      await CredentialsHistoryBlockchainConfig.provider.getBlockNumber();

    const checkpoints = await prisma.eventCheckpoint.findMany({
      where: { contractAddress: this.contractAddress },
    });

    return {
      currentBlockchainBlock: currentBlock,
      contractAddress: this.contractAddress,
      checkpoints: checkpoints.map((cp: any) => ({
        eventType: cp.eventType,
        lastSyncedBlock: cp.lastSyncedBlock.toString(),
        blockGap: currentBlock - Number(cp.lastSyncedBlock),
        isSynced: currentBlock - Number(cp.lastSyncedBlock) < 10,
        lastSyncedAt: cp.lastSyncedAt,
      })),
    };
  }
}

export default new CredentialsHistoryEventPublisher();
