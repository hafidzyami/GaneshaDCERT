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
  private lastProcessedBlock: { [eventType: string]: number } = {};

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
   * Enrich event data by decoding transaction input
   * This is needed for indexed string parameters which are hashed in events
   */
  private async enrichEventDataFromTransaction(
    eventType: string,
    eventLog: ethers.EventLog,
    eventData: any
  ): Promise<any> {
    try {
      // Get transaction details
      const tx = await CredentialsHistoryBlockchainConfig.provider.getTransaction(
        eventLog.transactionHash
      );
      if (!tx) {
        logger.warn(
          `[CredentialsHistory] Transaction not found: ${eventLog.transactionHash}`
        );
        return eventData;
      }

      // Decode transaction input data
      const decodedData = this.contract.interface.parseTransaction({
        data: tx.data,
        value: tx.value,
      });

      if (!decodedData) {
        logger.warn(
          `[CredentialsHistory] Could not decode transaction data for ${eventLog.transactionHash}`
        );
        return eventData;
      }

      logger.info(`[CredentialsHistory] Decoded transaction function: ${decodedData.name}`);

      // Extract actual values from function arguments based on event type
      // Only replace INDEXED parameters (hashed in events)
      switch (eventType) {
        case "CredentialHistoryCreated":
          // event CredentialHistoryCreated(string indexed id, string indexed issuerDID, string indexed holderDID, string historyType, uint8 status, string vcID, string newVCID)

          if (decodedData.name === "createCredentialHistoryInitiatedByIssuer" ||
              decodedData.name === "createCredentialHistoryInitiatedByHolder") {
            // createCredentialHistoryInitiatedByIssuer(string _id, string _issuerDID, string _holderDID, string _type, string _vcID)
            // createCredentialHistoryInitiatedByHolder(string _id, string _issuerDID, string _holderDID, string _type, string _vcID)
            return {
              id: String(decodedData.args[0]),              // _id
              issuerDID: String(decodedData.args[1]),       // _issuerDID
              holderDID: String(decodedData.args[2]),       // _holderDID
              historyType: String(decodedData.args[3]),     // _type (from tx, not event!)
              vcID: String(decodedData.args[4]),            // _vcID (from tx, not event!)
              status: eventData.status,                     // from event (not in function params)
              newVCID: eventData.newVCID,                   // from event (not in function params)
              blockNumber: eventData.blockNumber,
              transactionHash: eventData.transactionHash,
            };
          } else if (decodedData.name === "createCredentialHistoryInitiatedByIssuerWithNewVC" ||
                     decodedData.name === "createCredentialHistoryInitiatedByHolderWithNewVC") {
            // createCredentialHistoryInitiatedByIssuerWithNewVC(string _id, string _issuerDID, string _holderDID, string _type, string _oldVCID, string _newVCID)
            // createCredentialHistoryInitiatedByHolderWithNewVC(string _id, string _issuerDID, string _holderDID, string _type, string _oldVCID, string _newVCID)
            return {
              id: String(decodedData.args[0]),              // _id
              issuerDID: String(decodedData.args[1]),       // _issuerDID
              holderDID: String(decodedData.args[2]),       // _holderDID
              historyType: String(decodedData.args[3]),     // _type (from tx, not event!)
              vcID: String(decodedData.args[4]),            // _oldVCID (from tx, not event!)
              newVCID: String(decodedData.args[5]),         // _newVCID (from tx, not event!)
              status: eventData.status,                     // from event (not in function params)
              blockNumber: eventData.blockNumber,
              transactionHash: eventData.transactionHash,
            };
          }
          break;

        case "CredentialHistoryStatusChanged":
          // event CredentialHistoryStatusChanged(string indexed id, uint8 oldStatus, uint8 newStatus)
          // updateHistoryStatus(string _historyId, uint _newStatus)
          if (decodedData.name === "updateHistoryStatus") {
            return {
              id: String(decodedData.args[0]),              // indexed - from tx
              oldStatus: eventData.oldStatus,               // NOT indexed - from event
              newStatus: eventData.newStatus,               // NOT indexed - from event
              blockNumber: eventData.blockNumber,
              transactionHash: eventData.transactionHash,
            };
          }
          break;

        case "CredentialHistoryApproved":
          // event CredentialHistoryApproved(string indexed id, string indexed issuerDID, string indexed holderDID)
          // approveCredentialHistory(string _historyId)
          if (decodedData.name === "approveCredentialHistory") {
            const historyId = String(decodedData.args[0]);

            // issuerDID and holderDID are indexed but not in function params, need to query blockchain
            let issuerDID = eventData.issuerDID;
            let holderDID = eventData.holderDID;
            try {
              const historyData = await this.contract.getCredentialHistory(historyId);
              issuerDID = String(historyData.issuerDID);
              holderDID = String(historyData.holderDID);
              logger.debug(`[CredentialsHistory] Fetched DIDs from blockchain for history ${historyId}: issuer=${issuerDID}, holder=${holderDID}`);
            } catch (error) {
              logger.warn(`[CredentialsHistory] Could not fetch history data for ${historyId}, using event DIDs:`, error);
            }

            return {
              id: historyId,                                // indexed - from tx
              issuerDID: issuerDID,                         // indexed - from blockchain query
              holderDID: holderDID,                         // indexed - from blockchain query
              blockNumber: eventData.blockNumber,
              transactionHash: eventData.transactionHash,
            };
          }
          break;

        case "CredentialHistoryRejected":
          // event CredentialHistoryRejected(string indexed id, string indexed issuerDID, string indexed holderDID)
          // rejectCredentialHistory(string _historyId)
          if (decodedData.name === "rejectCredentialHistory") {
            const historyId = String(decodedData.args[0]);

            // issuerDID and holderDID are indexed but not in function params, need to query blockchain
            let issuerDID = eventData.issuerDID;
            let holderDID = eventData.holderDID;
            try {
              const historyData = await this.contract.getCredentialHistory(historyId);
              issuerDID = String(historyData.issuerDID);
              holderDID = String(historyData.holderDID);
              logger.debug(`[CredentialsHistory] Fetched DIDs from blockchain for history ${historyId}: issuer=${issuerDID}, holder=${holderDID}`);
            } catch (error) {
              logger.warn(`[CredentialsHistory] Could not fetch history data for ${historyId}, using event DIDs:`, error);
            }

            return {
              id: historyId,                                // indexed - from tx
              issuerDID: issuerDID,                         // indexed - from blockchain query
              holderDID: holderDID,                         // indexed - from blockchain query
              blockNumber: eventData.blockNumber,
              transactionHash: eventData.transactionHash,
            };
          }
          break;
      }

      // If no match, return original eventData
      logger.warn(
        `[CredentialsHistory] No enrichment pattern for ${eventType} with function ${decodedData.name}`
      );
      return eventData;
    } catch (error) {
      logger.error(
        `[CredentialsHistory] Error enriching event data from transaction:`,
        error
      );
      return eventData; // Return original data on error
    }
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
          Number(checkpoint.lastSyncedBlock);
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
    blockNumber: number
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
    blockNumber: number
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
   * Catch up with historical events (with batching to avoid RPC limits)
   */
  private async catchUpHistoricalEvents(): Promise<void> {
    try {
      const currentBlock =
        await CredentialsHistoryBlockchainConfig.provider.getBlockNumber();
      logger.info(
        `[CredentialsHistory] Current blockchain block: ${currentBlock}`
      );

      const BATCH_SIZE = 1000; // Query 1000 blocks at a time to avoid RPC limits

      for (const eventType of this.eventTypes) {
        const lastProcessed = this.lastProcessedBlock[eventType] || 0;
        let fromBlock = lastProcessed + 1;

        if (fromBlock > currentBlock) {
          logger.info(
            `[CredentialsHistory] ${eventType}: Already synced (block ${lastProcessed})`
          );
          continue;
        }

        logger.info(
          `[CredentialsHistory] Catching up ${eventType} from block ${fromBlock} to ${currentBlock}`
        );

        let totalEvents = 0;

        // Process in batches
        while (fromBlock <= currentBlock) {
          const toBlock = Math.min(fromBlock + BATCH_SIZE - 1, currentBlock);

          logger.debug(
            `[CredentialsHistory] ${eventType}: Querying blocks ${fromBlock} to ${toBlock}`
          );

          const filter = this.contract.filters[eventType]();
          const events = await this.contract.queryFilter(
            filter,
            fromBlock,
            toBlock
          );

          logger.debug(
            `[CredentialsHistory] Found ${events.length} ${eventType} events in batch`
          );

          for (const event of events) {
            await this.processEvent(eventType, event as ethers.EventLog);
          }

          totalEvents += events.length;

          // Update checkpoint after each batch
          await this.updateCheckpoint(eventType, toBlock);

          // Move to next batch
          fromBlock = toBlock + 1;
        }

        logger.info(
          `[CredentialsHistory] ${eventType}: Processed ${totalEvents} events total`
        );
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

    this.contract.on("CredentialHistoryCreated", async (id, issuerDID, holderDID, historyType, status, vcID, newVCID, timestamp, event) => {
      try {
        const eventLog = event.log as ethers.EventLog;
        const eventData = {
          id: id,                    // indexed - will be hash, enriched from tx
          issuerDID: issuerDID,      // indexed - will be hash, enriched from tx
          holderDID: holderDID,      // indexed - will be hash, enriched from tx
          historyType: String(historyType),
          status: Number(status),
          vcID: String(vcID),
          newVCID: String(newVCID),
          blockNumber: Number(eventLog.blockNumber),
          transactionHash: eventLog.transactionHash,
        };
        await this.processEvent("CredentialHistoryCreated", eventLog, eventData);
      } catch (error) {
        logger.error("[CredentialsHistory] Error processing CredentialHistoryCreated:", error);
      }
    });

    this.contract.on("CredentialHistoryStatusChanged", async (id, oldStatus, newStatus, timestamp, event) => {
      try {
        const eventLog = event.log as ethers.EventLog;
        const eventData = {
          id: id,                    // indexed - will be hash, enriched from tx
          oldStatus: Number(oldStatus),
          newStatus: Number(newStatus),
          blockNumber: Number(eventLog.blockNumber),
          transactionHash: eventLog.transactionHash,
        };
        await this.processEvent("CredentialHistoryStatusChanged", eventLog, eventData);
      } catch (error) {
        logger.error("[CredentialsHistory] Error processing CredentialHistoryStatusChanged:", error);
      }
    });

    this.contract.on("CredentialHistoryApproved", async (id, issuerDID, holderDID, timestamp, event) => {
      try {
        const eventLog = event.log as ethers.EventLog;
        const eventData = {
          id: id,                    // indexed - will be hash, enriched from tx
          issuerDID: issuerDID,      // indexed - will be hash, enriched from tx
          holderDID: holderDID,      // indexed - will be hash, enriched from tx
          blockNumber: Number(eventLog.blockNumber),
          transactionHash: eventLog.transactionHash,
        };
        await this.processEvent("CredentialHistoryApproved", eventLog, eventData);
      } catch (error) {
        logger.error("[CredentialsHistory] Error processing CredentialHistoryApproved:", error);
      }
    });

    this.contract.on("CredentialHistoryRejected", async (id, issuerDID, holderDID, timestamp, event) => {
      try {
        const eventLog = event.log as ethers.EventLog;
        const eventData = {
          id: id,                    // indexed - will be hash, enriched from tx
          issuerDID: issuerDID,      // indexed - will be hash, enriched from tx
          holderDID: holderDID,      // indexed - will be hash, enriched from tx
          blockNumber: Number(eventLog.blockNumber),
          transactionHash: eventLog.transactionHash,
        };
        await this.processEvent("CredentialHistoryRejected", eventLog, eventData);
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
    event: ethers.EventLog,
    eventData?: any
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
      // Extract event data from event logs if not provided
      if (!eventData) {
        eventData = this.extractEventData(eventType, event);
      }

      // ALWAYS enrich event data from transaction input
      // This is needed because indexed strings are hashed in events
      logger.info(`[CredentialsHistory] Enriching ${eventType} event data from transaction...`);
      eventData = await this.enrichEventDataFromTransaction(eventType, event, eventData);

      // Route to processor
      await this.routeToProcessor(eventType, eventData);

      // Mark as processed
      await this.markEventAsProcessed(
        event.transactionHash,
        event.index,
        eventType,
        Number(event.blockNumber)
      );

      // Update checkpoint
      await this.updateCheckpoint(eventType, Number(event.blockNumber));

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
   * Note: Indexed strings will be hashed - enrichment happens later via enrichEventDataFromTransaction
   */
  private extractEventData(eventType: string, event: ethers.EventLog): any {
    const baseData = {
      blockNumber: Number(event.blockNumber),
      transactionHash: event.transactionHash,
    };

    switch (eventType) {
      case "CredentialHistoryCreated":
        return {
          id: String(event.args[0]),          // indexed
          issuerDID: String(event.args[1]),   // indexed
          holderDID: String(event.args[2]),   // indexed
          historyType: String(event.args[3]),
          status: Number(event.args[4]),
          vcID: String(event.args[5]),
          newVCID: String(event.args[6]),
          ...baseData,
        };

      case "CredentialHistoryStatusChanged":
        return {
          id: String(event.args[0]),          // indexed
          oldStatus: Number(event.args[1]),
          newStatus: Number(event.args[2]),
          ...baseData,
        };

      case "CredentialHistoryApproved":
        return {
          id: String(event.args[0]),          // indexed
          issuerDID: String(event.args[1]),   // indexed
          holderDID: String(event.args[2]),   // indexed
          ...baseData,
        };

      case "CredentialHistoryRejected":
        return {
          id: String(event.args[0]),          // indexed
          issuerDID: String(event.args[1]),   // indexed
          holderDID: String(event.args[2]),   // indexed
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
