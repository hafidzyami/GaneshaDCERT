import { ethers } from "ethers";
import PaymentBlockchainConfig from "../config/paymentBlockchain";
import { prisma } from "../config/database";
import logger from "../config/logger";
import PaymentEventProcessor from "./processors/paymentEventProcessor";

/**
 * Payment Blockchain Event Publisher
 * Listens to events from PaymentManager contract and syncs to database
 */
class PaymentEventPublisher {
  private contract: ethers.Contract;
  private contractAddress: string;
  private processor: PaymentEventProcessor;
  private isRunning: boolean = false;
  private lastProcessedBlock: { [eventType: string]: bigint } = {};

  // Event types to listen for
  private eventTypes = [
    "OrderCreated",
    "OrderStatusChanged",
    "ItemCreated",
    "ItemPaid",
    "PaymentCreated",
    "PaymentStatusChanged",
    "PaymentCompleted",
  ];

  constructor() {
    this.contract = PaymentBlockchainConfig.contract;
    this.contractAddress = PaymentBlockchainConfig.contract.target as string;
    this.processor = new PaymentEventProcessor(prisma);
  }

  /**
   * Start listening to blockchain events
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn("[Payment] Event publisher is already running");
      return;
    }

    try {
      logger.info("[Payment] Starting event publisher...");

      // Load checkpoints from database
      await this.loadCheckpoints();

      // Catch up with historical events
      await this.catchUpHistoricalEvents();

      // Start listening to real-time events
      this.listenToRealtimeEvents();

      this.isRunning = true;
      logger.success("[Payment] Event publisher started successfully");
    } catch (error) {
      logger.error("[Payment] Failed to start event publisher:", error);
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

    logger.info("[Payment] Stopping event publisher...");
    this.contract.removeAllListeners();
    this.isRunning = false;
    logger.success("[Payment] Event publisher stopped");
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

      logger.info(`[Payment] Loaded ${checkpoints.length} checkpoints`);
    } catch (error) {
      logger.error("[Payment] Error loading checkpoints:", error);
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
        `[Payment] Error updating checkpoint for ${eventType}:`,
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
      logger.error("[Payment] Error checking processed event:", error);
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
      logger.error("[Payment] Error marking event as processed:", error);
    }
  }

  /**
   * Catch up with historical events (with batching to avoid RPC limits)
   */
  private async catchUpHistoricalEvents(): Promise<void> {
    try {
      const currentBlock =
        await PaymentBlockchainConfig.provider.getBlockNumber();
      logger.info(`[Payment] Current blockchain block: ${currentBlock}`);

      const BATCH_SIZE = 1000; // Query 1000 blocks at a time to avoid RPC limits

      for (const eventType of this.eventTypes) {
        const lastProcessed = this.lastProcessedBlock[eventType] || BigInt(0);
        let fromBlock = Number(lastProcessed) + 1;

        if (fromBlock > currentBlock) {
          logger.info(
            `[Payment] ${eventType}: Already synced (block ${lastProcessed})`
          );
          continue;
        }

        logger.info(
          `[Payment] Catching up ${eventType} from block ${fromBlock} to ${currentBlock}`
        );

        let totalEvents = 0;

        // Process in batches
        while (fromBlock <= currentBlock) {
          const toBlock = Math.min(fromBlock + BATCH_SIZE - 1, currentBlock);

          logger.debug(
            `[Payment] ${eventType}: Querying blocks ${fromBlock} to ${toBlock}`
          );

          const filter = this.contract.filters[eventType]();
          const events = await this.contract.queryFilter(
            filter,
            fromBlock,
            toBlock
          );

          logger.debug(
            `[Payment] Found ${events.length} ${eventType} events in batch`
          );

          for (const event of events) {
            await this.processEvent(eventType, event as ethers.EventLog);
          }

          totalEvents += events.length;

          // Update checkpoint after each batch
          await this.updateCheckpoint(eventType, BigInt(toBlock));

          // Move to next batch
          fromBlock = toBlock + 1;
        }

        logger.info(
          `[Payment] ${eventType}: Processed ${totalEvents} events total`
        );
      }

      logger.success("[Payment] Historical events catch-up completed");
    } catch (error) {
      logger.error("[Payment] Error catching up historical events:", error);
      throw error;
    }
  }

  /**
   * Listen to real-time events
   */
  private listenToRealtimeEvents(): void {
    logger.info("[Payment] Starting real-time event listeners...");

    this.contract.on(
      "OrderCreated",
      async (id, holderDID, status, amount, currency, timestamp, event) => {
        try {
          const eventLog = event.log as ethers.EventLog;
          await this.processEvent("OrderCreated", eventLog);
        } catch (error) {
          logger.error("[Payment] Error processing OrderCreated:", error);
        }
      }
    );

    this.contract.on(
      "OrderStatusChanged",
      async (id, oldStatus, newStatus, timestamp, event) => {
        try {
          const eventLog = event.log as ethers.EventLog;
          await this.processEvent("OrderStatusChanged", eventLog);
        } catch (error) {
          logger.error("[Payment] Error processing OrderStatusChanged:", error);
        }
      }
    );

    this.contract.on(
      "ItemCreated",
      async (id, vcID, vcHash, price, itemType, timestamp, event) => {
        try {
          const eventLog = event.log as ethers.EventLog;
          await this.processEvent("ItemCreated", eventLog);
        } catch (error) {
          logger.error("[Payment] Error processing ItemCreated:", error);
        }
      }
    );

    this.contract.on("ItemPaid", async (id, vcID, timestamp, event) => {
      try {
        const eventLog = event.log as ethers.EventLog;
        await this.processEvent("ItemPaid", eventLog);
      } catch (error) {
        logger.error("[Payment] Error processing ItemPaid:", error);
      }
    });

    this.contract.on(
      "PaymentCreated",
      async (id, orderID, method, status, amount, timestamp, event) => {
        try {
          const eventLog = event.log as ethers.EventLog;
          await this.processEvent("PaymentCreated", eventLog);
        } catch (error) {
          logger.error("[Payment] Error processing PaymentCreated:", error);
        }
      }
    );

    this.contract.on(
      "PaymentStatusChanged",
      async (id, orderID, oldStatus, newStatus, timestamp, event) => {
        try {
          const eventLog = event.log as ethers.EventLog;
          await this.processEvent("PaymentStatusChanged", eventLog);
        } catch (error) {
          logger.error(
            "[Payment] Error processing PaymentStatusChanged:",
            error
          );
        }
      }
    );

    this.contract.on(
      "PaymentCompleted",
      async (id, orderID, amount, timestamp, event) => {
        try {
          const eventLog = event.log as ethers.EventLog;
          await this.processEvent("PaymentCompleted", eventLog);
        } catch (error) {
          logger.error("[Payment] Error processing PaymentCompleted:", error);
        }
      }
    );

    logger.success("[Payment] Real-time event listeners started");
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
        `[Payment] Event already processed: ${eventType} ${event.transactionHash}:${event.index}`
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
        `[Payment] Processed ${eventType} at block ${event.blockNumber}`
      );
    } catch (error) {
      logger.error(`[Payment] Error processing ${eventType}:`, error);
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
      case "OrderCreated":
        return {
          id: String(event.args[0]),
          holderDID: String(event.args[1]),
          status: Number(event.args[2]),
          amount: BigInt(event.args[3]),
          currency: String(event.args[4]),
          timestamp: BigInt(event.args[5]),
          ...baseData,
        };

      case "OrderStatusChanged":
        return {
          id: String(event.args[0]),
          oldStatus: Number(event.args[1]),
          newStatus: Number(event.args[2]),
          timestamp: BigInt(event.args[3]),
          ...baseData,
        };

      case "ItemCreated":
        return {
          id: String(event.args[0]),
          vcID: String(event.args[1]),
          vcHash: String(event.args[2]),
          price: BigInt(event.args[3]),
          itemType: Number(event.args[4]),
          timestamp: BigInt(event.args[5]),
          ...baseData,
        };

      case "ItemPaid":
        return {
          id: String(event.args[0]),
          vcID: String(event.args[1]),
          timestamp: BigInt(event.args[2]),
          ...baseData,
        };

      case "PaymentCreated":
        return {
          id: String(event.args[0]),
          orderID: String(event.args[1]),
          method: String(event.args[2]),
          status: String(event.args[3]),
          amount: BigInt(event.args[4]),
          timestamp: BigInt(event.args[5]),
          ...baseData,
        };

      case "PaymentStatusChanged":
        return {
          id: String(event.args[0]),
          orderID: String(event.args[1]),
          oldStatus: String(event.args[2]),
          newStatus: String(event.args[3]),
          timestamp: BigInt(event.args[4]),
          ...baseData,
        };

      case "PaymentCompleted":
        return {
          id: String(event.args[0]),
          orderID: String(event.args[1]),
          amount: BigInt(event.args[2]),
          timestamp: BigInt(event.args[3]),
          ...baseData,
        };

      default:
        logger.warn(`[Payment] Unknown event type: ${eventType}`);
        return baseData;
    }
  }

  /**
   * Route event to appropriate processor handler
   */
  private async routeToProcessor(
    eventType: string,
    eventData: any
  ): Promise<void> {
    switch (eventType) {
      case "OrderCreated":
        await this.processor.handleOrderCreated(eventData);
        break;

      case "OrderStatusChanged":
        await this.processor.handleOrderStatusChanged(eventData);
        break;

      case "ItemCreated":
        await this.processor.handleItemCreated(eventData);
        break;

      case "ItemPaid":
        await this.processor.handleItemPaid(eventData);
        break;

      case "PaymentCreated":
        await this.processor.handlePaymentCreated(eventData);
        break;

      case "PaymentStatusChanged":
        await this.processor.handlePaymentStatusChanged(eventData);
        break;

      case "PaymentCompleted":
        await this.processor.handlePaymentCompleted(eventData);
        break;

      default:
        logger.warn(`[Payment] No handler for event type: ${eventType}`);
    }
  }

  /**
   * Get sync status for monitoring
   */
  async getSyncStatus(): Promise<any> {
    const currentBlock =
      await PaymentBlockchainConfig.provider.getBlockNumber();

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

export default new PaymentEventPublisher();
