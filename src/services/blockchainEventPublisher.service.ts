import { ethers } from "ethers";
import VCBlockchainConfig from "../config/vcblockchain";
import logger from "../config/logger";
import { PrismaClient } from "@prisma/client";
import SchemaEventProcessor from "./processors/schemaEventProcessor";

const prisma = new PrismaClient();

/**
 * BlockchainEventPublisher
 * Listens to blockchain events and processes them with checkpoint mechanism
 */
class BlockchainEventPublisher {
  private contract: ethers.Contract;
  private provider: ethers.JsonRpcProvider;
  private contractAddress: string;
  private isRunning: boolean = false;
  private schemaProcessor: SchemaEventProcessor;

  constructor() {
    this.contract = VCBlockchainConfig.contract;
    this.provider = VCBlockchainConfig.provider;
    this.contractAddress = this.contract.target as string;
    this.schemaProcessor = new SchemaEventProcessor(prisma);
  }

  /**
   * Initialize and start the event publisher
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn("BlockchainEventPublisher is already running");
      return;
    }

    logger.info("=== Starting Blockchain Event Publisher ===");

    try {
      // 1. Test blockchain connection
      const isConnected = await VCBlockchainConfig.isConnected();
      if (!isConnected) {
        throw new Error("Cannot connect to blockchain");
      }

      // 2. Catch up missed events
      logger.info("Checking for missed events...");
      await this.catchUpMissedEvents();

      // 3. Start real-time event listeners
      logger.info("Starting real-time event listeners...");
      await this.startRealtimeListeners();

      this.isRunning = true;
      logger.success("=== Blockchain Event Publisher Ready ===");
    } catch (error) {
      logger.error("Failed to start BlockchainEventPublisher:", error);
      throw error;
    }
  }

  /**
   * Stop the event publisher
   */
  async stop(): Promise<void> {
    logger.info("Stopping Blockchain Event Publisher...");

    // Remove all listeners
    this.contract.removeAllListeners();

    this.isRunning = false;
    logger.info("Blockchain Event Publisher stopped");
  }

  /**
   * Catch up missed events from last checkpoint
   */
  private async catchUpMissedEvents(): Promise<void> {
    const currentBlock = await this.provider.getBlockNumber();
    logger.info(`Current blockchain block: ${currentBlock}`);

    const eventTypes = [
      "SchemaCreated",
      "SchemaUpdated",
      "SchemaDeactivated",
      "SchemaReactivated",
    ];

    for (const eventType of eventTypes) {
      try {
        const checkpoint = await prisma.eventCheckpoint.findUnique({
          where: {
            contractAddress_eventType: {
              contractAddress: this.contractAddress,
              eventType,
            },
          },
        });

        const lastBlock = checkpoint?.lastSyncedBlock
          ? Number(checkpoint.lastSyncedBlock)
          : 0;

        if (currentBlock > lastBlock) {
          const gap = currentBlock - lastBlock;
          logger.info(`${eventType}: Found ${gap} blocks to catch up`);

          await this.queryHistoricalEvents(eventType, lastBlock + 1, currentBlock);
        } else {
          logger.info(`${eventType}: Already up to date`);
        }
      } catch (error) {
        logger.error(`Error catching up ${eventType} events:`, error);
        throw error;
      }
    }
  }

  /**
   * Query historical events in batches
   */
  private async queryHistoricalEvents(
    eventType: string,
    fromBlock: number,
    toBlock: number
  ): Promise<void> {
    const BATCH_SIZE = 1000;

    for (let start = fromBlock; start <= toBlock; start += BATCH_SIZE) {
      const end = Math.min(start + BATCH_SIZE - 1, toBlock);

      logger.info(`Processing ${eventType} from block ${start} to ${end}`);

      try {
        const filter = this.contract.filters[eventType]();
        const events = await this.contract.queryFilter(filter, start, end);

        logger.info(`Found ${events.length} ${eventType} events`);

        for (const event of events) {
          await this.processEvent(eventType, event);
        }

        // Update checkpoint after each batch
        await this.updateCheckpoint(eventType, BigInt(end));
      } catch (error) {
        logger.error(`Error processing blocks ${start}-${end}:`, error);
        throw error;
      }
    }
  }

  /**
   * Start listening to real-time events
   */
  private async startRealtimeListeners(): Promise<void> {
    // Schema events
    this.contract.on(
      "SchemaCreated",
      async (id, name, schema, issuerDID, imageLink, version, timestamp, event) => {
        // Don't convert indexed strings here - they're hashes and will be enriched later
        await this.handleEvent("SchemaCreated", event, {
          id: id,                    // indexed - will be hash, enriched from tx
          name: String(name),        // not indexed - safe to convert
          schema: String(schema),    // not indexed - safe to convert
          issuerDID: issuerDID,      // indexed - will be hash, enriched from tx
          imageLink: String(imageLink), // not indexed - safe to convert
          version: Number(version),     // not indexed uint - safe to convert
          timestamp: Number(timestamp), // not indexed uint - safe to convert
        });
      }
    );

    this.contract.on(
      "SchemaUpdated",
      async (id, schema, issuerDID, imageLink, oldVersion, newVersion, timestamp, event) => {
        // Don't convert indexed strings here - they're hashes and will be enriched later
        await this.handleEvent("SchemaUpdated", event, {
          id: id,                          // indexed - will be hash, enriched from tx
          schema: String(schema),          // not indexed - safe to convert
          issuerDID: issuerDID,            // indexed - will be hash, enriched from tx
          imageLink: String(imageLink),    // not indexed - safe to convert
          oldVersion: Number(oldVersion),  // not indexed uint - safe to convert
          newVersion: Number(newVersion),  // not indexed uint - safe to convert
          timestamp: Number(timestamp),    // not indexed uint - safe to convert
        });
      }
    );

    this.contract.on(
      "SchemaDeactivated",
      async (id, version, issuerDID, timestamp, event) => {
        // Don't convert indexed strings here - they're hashes and will be enriched later
        await this.handleEvent("SchemaDeactivated", event, {
          id: id,                       // indexed - will be hash, enriched from tx
          version: Number(version),     // indexed uint - safe to convert (uint indexed can be read)
          issuerDID: String(issuerDID), // not indexed - safe to convert
          timestamp: Number(timestamp), // not indexed uint - safe to convert
        });
      }
    );

    this.contract.on(
      "SchemaReactivated",
      async (id, version, issuerDID, timestamp, event) => {
        // Don't convert indexed strings here - they're hashes and will be enriched later
        await this.handleEvent("SchemaReactivated", event, {
          id: id,                       // indexed - will be hash, enriched from tx
          version: Number(version),     // indexed uint - safe to convert (uint indexed can be read)
          issuerDID: String(issuerDID), // not indexed - safe to convert
          timestamp: Number(timestamp), // not indexed uint - safe to convert
        });
      }
    );

    logger.success("Real-time event listeners started");
  }

  /**
   * Handle real-time event with retry
   */
  private async handleEvent(
    eventType: string,
    event: any,
    eventData: any
  ): Promise<void> {
    // In ethers.js v6, the event parameter has a 'log' property containing the actual EventLog
    const eventLog = event.log as ethers.EventLog;

    logger.info(`Received ${eventType} event:`, {
      blockNumber: eventLog.blockNumber,
      transactionHash: eventLog.transactionHash,
      logIndex: eventLog.index,
      eventType: eventType
    });

    try {
      await this.processEventWithRetry(eventType, eventLog, eventData);
    } catch (error) {
      logger.error(`Failed to process ${eventType} event:`, error);
    }
  }

  /**
   * Process event with retry mechanism
   */
  private async processEventWithRetry(
    eventType: string,
    event: ethers.EventLog,
    eventData: any,
    maxRetries: number = 3
  ): Promise<void> {
    let retries = 0;
    let lastError: any;

    while (retries < maxRetries) {
      try {
        await this.processEvent(eventType, event, eventData);
        await this.updateCheckpoint(eventType, BigInt(event.blockNumber));
        return;
      } catch (error) {
        lastError = error;
        retries++;

        if (retries < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, retries), 10000);
          logger.warn(
            `Retry ${retries}/${maxRetries} for ${eventType} after ${delay}ms`
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    // Save failed event for manual inspection
    logger.error(
      `Failed to process ${eventType} after ${maxRetries} retries:`,
      lastError
    );
    await this.saveFailedEvent(eventType, event, eventData, lastError);
  }

  /**
   * Process a single event
   */
  private async processEvent(
    eventType: string,
    event: ethers.EventLog | ethers.Log,
    eventData?: any
  ): Promise<void> {
    const eventLog = event as ethers.EventLog;

    // Check if already processed FIRST (idempotency) - before any expensive operations
    const existing = await prisma.processedEvent.findUnique({
      where: {
        transactionHash_logIndex: {
          transactionHash: eventLog.transactionHash,
          logIndex: eventLog.index,
        },
      },
    });

    if (existing) {
      logger.debug(
        `Event ${eventLog.transactionHash}:${eventLog.index} already processed, skipping`
      );
      return;
    }

    logger.info(`Processing new ${eventType} event:`, {
      txHash: eventLog.transactionHash,
      logIndex: eventLog.index,
      blockNumber: eventLog.blockNumber,
      hasEventData: !!eventData
    });

    // Extract event data from logs if not provided
    if (!eventData && eventLog.args) {
      eventData = this.extractEventData(eventType, eventLog);
    }

    // ALWAYS enrich event data for indexed string parameters
    // This is needed because indexed strings are hashed in events
    if (["SchemaCreated", "SchemaUpdated", "SchemaDeactivated", "SchemaReactivated"].includes(eventType)) {
      logger.info(`Enriching ${eventType} event data from transaction...`);
      eventData = await this.enrichEventDataFromTransaction(eventType, eventLog, eventData);
    }

    // Process event based on type
    try {
      await this.routeEventToProcessor(eventType, eventData, eventLog);
    } catch (processingError: any) {
      logger.error(`Failed to route event to processor:`, {
        eventType,
        txHash: eventLog.transactionHash,
        logIndex: eventLog.index,
        error: processingError.message,
        stack: processingError.stack,
        eventData: eventData
      });
      throw processingError; // Re-throw to trigger retry
    }

    // Mark as processed ONLY if processing succeeded
    await prisma.processedEvent.create({
      data: {
        transactionHash: eventLog.transactionHash,
        logIndex: eventLog.index,
        blockNumber: BigInt(eventLog.blockNumber),
        eventType,
        contractAddress: eventLog.address,
      },
    });

    logger.success(
      `Processed ${eventType} at block ${eventLog.blockNumber}, tx: ${eventLog.transactionHash}`
    );
  }

  /**
   * Extract event data from EventLog
   */
  private extractEventData(eventType: string, event: ethers.EventLog): any {
    const args = event.args;

    switch (eventType) {
      case "SchemaCreated":
        return {
          id: String(args[0]),
          name: String(args[1]),
          schema: String(args[2]),
          issuerDID: String(args[3]),
          imageLink: String(args[4]),
          version: Number(args[5]),
          timestamp: Number(args[6]),
        };

      case "SchemaUpdated":
        return {
          id: String(args[0]),
          schema: String(args[1]),
          issuerDID: String(args[2]),
          imageLink: String(args[3]),
          oldVersion: Number(args[4]),
          newVersion: Number(args[5]),
          timestamp: Number(args[6]),
        };

      case "SchemaDeactivated":
      case "SchemaReactivated":
        return {
          id: String(args[0]),
          version: Number(args[1]),
          issuerDID: String(args[2]),
          timestamp: Number(args[3]),
        };

      default:
        return args;
    }
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
      const tx = await this.provider.getTransaction(eventLog.transactionHash);
      if (!tx) {
        logger.warn(`Transaction not found: ${eventLog.transactionHash}`);
        return eventData;
      }

      // Decode transaction input data
      const decodedData = this.contract.interface.parseTransaction({
        data: tx.data,
        value: tx.value
      });

      if (!decodedData) {
        logger.warn(`Could not decode transaction data for ${eventLog.transactionHash}`);
        return eventData;
      }

      logger.info(`Decoded transaction function: ${decodedData.name}`, {
        args: decodedData.args.map((arg: any) => String(arg))
      });

      // Extract actual values from function arguments
      if (eventType === "SchemaCreated" && decodedData.name === "createVCSchema") {
        // createVCSchema(string _id, string _name, string _schema, string _issuerDID, string _imageLink)
        return {
          id: String(decodedData.args[0]),          // _id
          name: String(decodedData.args[1]),        // _name
          schema: String(decodedData.args[2]),      // _schema
          issuerDID: String(decodedData.args[3]),   // _issuerDID
          imageLink: String(decodedData.args[4]),   // _imageLink
          version: eventData.version,                // from event (uint)
          timestamp: eventData.timestamp,            // from event (uint)
        };
      }

      else if (eventType === "SchemaUpdated" && decodedData.name === "updateVCSchema") {
        // updateVCSchema(string _id, string _newSchema, string _newImageLink)
        const schemaId = String(decodedData.args[0]);

        // Get issuerDID from the new version on blockchain (after update)
        let issuerDID = "";
        try {
          const newVersion = eventData.newVersion;
          const schemaData = await this.contract.getVCSchemaByVersion(schemaId, newVersion);
          issuerDID = String(schemaData.issuerDID);
          logger.info(`Fetched issuerDID from blockchain for schema ${schemaId} v${newVersion}: ${issuerDID}`);
        } catch (error) {
          logger.error(`Error fetching schema from blockchain:`, error);
          // Fallback: try to get from old version
          try {
            const oldVersion = eventData.oldVersion;
            const oldSchemaData = await this.contract.getVCSchemaByVersion(schemaId, oldVersion);
            issuerDID = String(oldSchemaData.issuerDID);
            logger.info(`Fetched issuerDID from old version ${oldVersion}: ${issuerDID}`);
          } catch (fallbackError) {
            logger.error(`Fallback fetch also failed:`, fallbackError);
            issuerDID = String(eventData.issuerDID); // Last resort: hashed value
          }
        }

        return {
          id: schemaId,                             // _id
          schema: String(decodedData.args[1]),      // _newSchema
          imageLink: String(decodedData.args[2]),   // _newImageLink
          issuerDID: issuerDID,                     // from blockchain query
          oldVersion: eventData.oldVersion,         // from event
          newVersion: eventData.newVersion,         // from event
          timestamp: eventData.timestamp,           // from event
        };
      }

      else if (eventType === "SchemaDeactivated" && decodedData.name === "deactivateVCSchema") {
        // deactivateVCSchema(string _id, uint _version)
        return {
          id: String(decodedData.args[0]),          // _id
          version: Number(decodedData.args[1]),     // _version
          issuerDID: eventData.issuerDID,           // from event (non-indexed)
          timestamp: eventData.timestamp,           // from event
        };
      }

      else if (eventType === "SchemaReactivated" && decodedData.name === "reactivateVCSchema") {
        // reactivateVCSchema(string _id, uint _version)
        return {
          id: String(decodedData.args[0]),          // _id
          version: Number(decodedData.args[1]),     // _version
          issuerDID: eventData.issuerDID,           // from event (non-indexed)
          timestamp: eventData.timestamp,           // from event
        };
      }

      return eventData;
    } catch (error) {
      logger.error(`Error enriching event data from transaction:`, error);
      return eventData;
    }
  }

  /**
   * Route event to appropriate processor
   */
  private async routeEventToProcessor(
    eventType: string,
    eventData: any,
    event: ethers.EventLog
  ): Promise<void> {
    switch (eventType) {
      case "SchemaCreated":
        await this.schemaProcessor.handleSchemaCreated(eventData);
        break;

      case "SchemaUpdated":
        await this.schemaProcessor.handleSchemaUpdated(eventData);
        break;

      case "SchemaDeactivated":
        await this.schemaProcessor.handleSchemaDeactivated(eventData);
        break;

      case "SchemaReactivated":
        await this.schemaProcessor.handleSchemaReactivated(eventData);
        break;

      default:
        logger.warn(`Unknown event type: ${eventType}`);
    }
  }

  /**
   * Update checkpoint
   */
  private async updateCheckpoint(
    eventType: string,
    blockNumber: bigint
  ): Promise<void> {
    await prisma.eventCheckpoint.upsert({
      where: {
        contractAddress_eventType: {
          contractAddress: this.contractAddress,
          eventType,
        },
      },
      create: {
        contractAddress: this.contractAddress,
        eventType,
        lastSyncedBlock: blockNumber,
        lastSyncedAt: new Date(),
      },
      update: {
        lastSyncedBlock: blockNumber,
        lastSyncedAt: new Date(),
      },
    });
  }

  /**
   * Save failed event for manual retry
   */
  private async saveFailedEvent(
    eventType: string,
    event: ethers.EventLog | ethers.Log,
    eventData: any,
    error: any
  ): Promise<void> {
    // You can create a FailedEvent model if needed
    logger.error("Failed event saved for manual inspection:", {
      eventType,
      blockNumber: event.blockNumber,
      transactionHash: event.transactionHash,
      eventData,
      error: error.message,
    });
  }

  /**
   * Get sync status
   */
  async getSyncStatus(): Promise<any> {
    const currentBlock = await this.provider.getBlockNumber();

    const checkpoints = await prisma.eventCheckpoint.findMany({
      where: { contractAddress: this.contractAddress },
    });

    return {
      currentBlockchainBlock: currentBlock,
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

// Singleton instance
const blockchainEventPublisher = new BlockchainEventPublisher();

export default blockchainEventPublisher;
