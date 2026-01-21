import { ethers } from "ethers";
import PaymentBlockchainConfig from "../config/paymentBlockchain";
import { prisma } from "../config/database";
import logger from "../config/logger";
import PaymentEventProcessor from "./processors/paymentEventProcessor";
import { invoiceToBytes32, bytes32ToString } from "../utils/blockchain.helper";

/**
 * Payment Blockchain Event Publisher
 * Listens to events from PaymentManager contract and syncs to database
 *
 * NOTE: This version is updated for the bytes32 PaymentManager contract.
 * All IDs and string parameters are stored as bytes32 in the contract.
 */
class PaymentEventPublisher {
  private contract: ethers.Contract;
  private contractAddress: string;
  private processor: PaymentEventProcessor;
  private isRunning: boolean = false;
  private lastProcessedBlock: { [eventType: string]: number } = {};

  // Event types to listen for
  private eventTypes = [
    "OrderCreated",
    "OrderStatusChanged",
    "ItemCreated",
    "ItemPaid",
    "PaymentCreated",
    "PaymentStatusChanged",
    "PaymentFailed",
    "PaymentCompleted",
  ];

  constructor() {
    this.contract = PaymentBlockchainConfig.contract;
    this.contractAddress = PaymentBlockchainConfig.contract.target as string;
    this.processor = new PaymentEventProcessor(prisma);
  }

  /**
   * Enrich event data by looking up original IDs from database
   * For bytes32 contract, we need to find original string IDs that were hashed
   */
  private async enrichEventDataFromTransaction(
    eventType: string,
    eventLog: ethers.EventLog,
    eventData: any
  ): Promise<any> {
    try {
      logger.debug(`[Payment] Enriching ${eventType} event data...`);

      // For bytes32 contract, we look up original IDs from database
      // The worker stores original string IDs, so we search by matching bytes32 hash
      switch (eventType) {
        case "OrderCreated": {
          const id = await this.lookupOriginalId(eventData.idBytes32, 'order');
          return {
            ...eventData,
            id: id || eventData.idBytes32,
            holderDID: eventData.holderDIDBytes32, // DIDs are always hashed, keep as bytes32
          };
        }

        case "OrderStatusChanged": {
          const id = await this.lookupOriginalId(eventData.idBytes32, 'order');
          return {
            ...eventData,
            id: id || eventData.idBytes32,
          };
        }

        case "ItemCreated": {
          const id = await this.lookupOriginalId(eventData.idBytes32, 'item');
          return {
            ...eventData,
            id: id || eventData.idBytes32,
            vcID: eventData.vcIDBytes32, // VC IDs are usually hashed
            issuerDID: eventData.issuerDIDBytes32,
            holderDID: eventData.holderDIDBytes32,
            vcHash: eventData.vcHashBytes32,
          };
        }

        case "ItemPaid": {
          const id = await this.lookupOriginalId(eventData.idBytes32, 'item');
          // Try to get vcID from database
          let vcID = eventData.vcIDBytes32;
          if (id) {
            const item = await prisma.itemBlockchain.findUnique({
              where: { id },
              select: { vcID: true },
            });
            if (item) vcID = item.vcID;
          }
          return {
            ...eventData,
            id: id || eventData.idBytes32,
            vcID,
          };
        }

        case "PaymentCreated": {
          const id = await this.lookupOriginalId(eventData.idBytes32, 'payment');
          const orderID = await this.lookupOriginalId(eventData.orderIDBytes32, 'order');
          return {
            ...eventData,
            id: id || eventData.idBytes32,
            orderID: orderID || eventData.orderIDBytes32,
          };
        }

        case "PaymentStatusChanged": {
          const id = await this.lookupOriginalId(eventData.idBytes32, 'payment');
          const orderID = await this.lookupOriginalId(eventData.orderIDBytes32, 'order');
          return {
            ...eventData,
            id: id || eventData.idBytes32,
            orderID: orderID || eventData.orderIDBytes32,
          };
        }

        case "PaymentFailed": {
          const id = await this.lookupOriginalId(eventData.idBytes32, 'payment');
          const orderID = await this.lookupOriginalId(eventData.orderIDBytes32, 'order');
          return {
            ...eventData,
            id: id || eventData.idBytes32,
            orderID: orderID || eventData.orderIDBytes32,
          };
        }

        case "PaymentCompleted": {
          const id = await this.lookupOriginalId(eventData.idBytes32, 'payment');
          const orderID = await this.lookupOriginalId(eventData.orderIDBytes32, 'order');
          return {
            ...eventData,
            id: id || eventData.idBytes32,
            orderID: orderID || eventData.orderIDBytes32,
          };
        }

        default:
          return eventData;
      }
    } catch (error: any) {
      logger.error(
        `[Payment] Error enriching event data:`,
        {
          message: error?.message,
          eventType: eventType,
          transactionHash: eventLog.transactionHash,
        }
      );
      return eventData; // Return original data on error
    }
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
    } catch (error: any) {
      logger.error("[Payment] Failed to start event publisher:", {
        message: error?.message,
        stack: error?.stack,
        name: error?.name,
        error: error,
      });
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
          Number(checkpoint.lastSyncedBlock);
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
        const lastProcessed = this.lastProcessedBlock[eventType] || 0;
        let fromBlock = lastProcessed + 1;

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
          await this.updateCheckpoint(eventType, toBlock);

          // Move to next batch
          fromBlock = toBlock + 1;
        }

        logger.info(
          `[Payment] ${eventType}: Processed ${totalEvents} events total`
        );
      }

      logger.success("[Payment] Historical events catch-up completed");
    } catch (error: any) {
      logger.error("[Payment] Error catching up historical events:", {
        message: error?.message,
        stack: error?.stack,
        name: error?.name,
        error: error,
      });
      throw error;
    }
  }

  /**
   * Listen to real-time events
   * NOTE: Updated for bytes32 contract - all indexed parameters are bytes32
   */
  private listenToRealtimeEvents(): void {
    logger.info("[Payment] Starting real-time event listeners (bytes32 version)...");

    // OrderCreated(bytes32 indexed id, bytes32 indexed holderDID, uint8 status, uint256 amount, bytes32 currency, uint256 timestamp)
    this.contract.on(
      "OrderCreated",
      async (id, holderDID, status, amount, currency, timestamp, event) => {
        try {
          const eventLog = event.log as ethers.EventLog;
          const eventData = {
            idBytes32: String(id),                    // indexed bytes32
            holderDIDBytes32: String(holderDID),      // indexed bytes32
            status: Number(status),                   // uint8
            amount: Number(amount),                   // uint256
            currencyBytes32: String(currency),        // bytes32
            currency: this.tryDecodeBytes32(currency), // Try decode short strings
            timestamp: Number(timestamp),             // uint256
            blockNumber: Number(eventLog.blockNumber),
            transactionHash: eventLog.transactionHash,
          };
          await this.processEvent("OrderCreated", eventLog, eventData);
        } catch (error) {
          logger.error("[Payment] Error processing OrderCreated:", error);
        }
      }
    );

    // OrderStatusChanged(bytes32 indexed id, uint8 oldStatus, uint8 newStatus, uint256 timestamp)
    this.contract.on(
      "OrderStatusChanged",
      async (id, oldStatus, newStatus, timestamp, event) => {
        try {
          const eventLog = event.log as ethers.EventLog;
          const eventData = {
            idBytes32: String(id),                    // indexed bytes32
            oldStatus: Number(oldStatus),             // uint8
            newStatus: Number(newStatus),             // uint8
            timestamp: Number(timestamp),             // uint256
            blockNumber: Number(eventLog.blockNumber),
            transactionHash: eventLog.transactionHash,
          };
          await this.processEvent("OrderStatusChanged", eventLog, eventData);
        } catch (error) {
          logger.error("[Payment] Error processing OrderStatusChanged:", error);
        }
      }
    );

    // ItemCreated(bytes32 indexed id, bytes32 indexed vcID, bytes32 issuerDID, bytes32 holderDID, bytes32 vcHash, uint256 price, uint8 itemType, uint256 timestamp)
    this.contract.on(
      "ItemCreated",
      async (id, vcID, issuerDID, holderDID, vcHash, price, itemType, timestamp, event) => {
        try {
          const eventLog = event.log as ethers.EventLog;
          const eventData = {
            idBytes32: String(id),                    // indexed bytes32
            vcIDBytes32: String(vcID),                // indexed bytes32
            issuerDIDBytes32: String(issuerDID),      // bytes32
            holderDIDBytes32: String(holderDID),      // bytes32
            vcHashBytes32: String(vcHash),            // bytes32
            price: Number(price),                     // uint256
            itemType: Number(itemType),               // uint8
            timestamp: Number(timestamp),             // uint256
            blockNumber: Number(eventLog.blockNumber),
            transactionHash: eventLog.transactionHash,
          };
          await this.processEvent("ItemCreated", eventLog, eventData);
        } catch (error) {
          logger.error("[Payment] Error processing ItemCreated:", error);
        }
      }
    );

    // ItemPaid(bytes32 indexed id, bytes32 indexed vcID, uint256 timestamp)
    this.contract.on("ItemPaid", async (id, vcID, timestamp, event) => {
      try {
        const eventLog = event.log as ethers.EventLog;
        const eventData = {
          idBytes32: String(id),                      // indexed bytes32
          vcIDBytes32: String(vcID),                  // indexed bytes32
          timestamp: Number(timestamp),               // uint256
          blockNumber: Number(eventLog.blockNumber),
          transactionHash: eventLog.transactionHash,
        };
        await this.processEvent("ItemPaid", eventLog, eventData);
      } catch (error) {
        logger.error("[Payment] Error processing ItemPaid:", error);
      }
    });

    // PaymentCreated(bytes32 indexed id, bytes32 indexed orderID, bytes32 method, bytes32 status, uint256 amount, uint256 timestamp)
    this.contract.on(
      "PaymentCreated",
      async (id, orderID, method, status, amount, timestamp, event) => {
        try {
          const eventLog = event.log as ethers.EventLog;
          const eventData = {
            idBytes32: String(id),                    // indexed bytes32
            orderIDBytes32: String(orderID),          // indexed bytes32
            methodBytes32: String(method),            // bytes32
            method: this.tryDecodeBytes32(method),    // Try decode short strings
            statusBytes32: String(status),            // bytes32
            status: this.tryDecodeBytes32(status),    // Try decode short strings
            amount: Number(amount),                   // uint256
            timestamp: Number(timestamp),             // uint256
            blockNumber: Number(eventLog.blockNumber),
            transactionHash: eventLog.transactionHash,
          };
          await this.processEvent("PaymentCreated", eventLog, eventData);
        } catch (error) {
          logger.error("[Payment] Error processing PaymentCreated:", error);
        }
      }
    );

    // PaymentStatusChanged(bytes32 indexed id, bytes32 indexed orderID, bytes32 oldStatus, bytes32 newStatus, uint256 timestamp)
    this.contract.on(
      "PaymentStatusChanged",
      async (id, orderID, oldStatus, newStatus, timestamp, event) => {
        try {
          const eventLog = event.log as ethers.EventLog;
          const eventData = {
            idBytes32: String(id),                    // indexed bytes32
            orderIDBytes32: String(orderID),          // indexed bytes32
            oldStatusBytes32: String(oldStatus),      // bytes32
            oldStatus: this.tryDecodeBytes32(oldStatus),
            newStatusBytes32: String(newStatus),      // bytes32
            newStatus: this.tryDecodeBytes32(newStatus),
            timestamp: Number(timestamp),             // uint256
            blockNumber: Number(eventLog.blockNumber),
            transactionHash: eventLog.transactionHash,
          };
          await this.processEvent("PaymentStatusChanged", eventLog, eventData);
        } catch (error) {
          logger.error(
            "[Payment] Error processing PaymentStatusChanged:",
            error
          );
        }
      }
    );

    // PaymentFailed(bytes32 indexed id, bytes32 indexed orderID, bytes32 method, uint256 amount, uint256 timestamp)
    this.contract.on(
      "PaymentFailed",
      async (id, orderID, method, amount, timestamp, event) => {
        try {
          const eventLog = event.log as ethers.EventLog;
          const eventData = {
            idBytes32: String(id),                    // indexed bytes32
            orderIDBytes32: String(orderID),          // indexed bytes32
            methodBytes32: String(method),            // bytes32
            method: this.tryDecodeBytes32(method),
            amount: Number(amount),                   // uint256
            timestamp: Number(timestamp),             // uint256
            blockNumber: Number(eventLog.blockNumber),
            transactionHash: eventLog.transactionHash,
          };
          await this.processEvent("PaymentFailed", eventLog, eventData);
        } catch (error) {
          logger.error("[Payment] Error processing PaymentFailed:", error);
        }
      }
    );

    // PaymentCompleted(bytes32 indexed id, bytes32 indexed orderID, bytes32 method, uint256 amount, uint256 timestamp)
    this.contract.on(
      "PaymentCompleted",
      async (id, orderID, method, amount, timestamp, event) => {
        try {
          const eventLog = event.log as ethers.EventLog;
          const eventData = {
            idBytes32: String(id),                    // indexed bytes32
            orderIDBytes32: String(orderID),          // indexed bytes32
            methodBytes32: String(method),            // bytes32
            method: this.tryDecodeBytes32(method),
            amount: Number(amount),                   // uint256
            timestamp: Number(timestamp),             // uint256
            blockNumber: Number(eventLog.blockNumber),
            transactionHash: eventLog.transactionHash,
          };
          await this.processEvent("PaymentCompleted", eventLog, eventData);
        } catch (error) {
          logger.error("[Payment] Error processing PaymentCompleted:", error);
        }
      }
    );

    logger.success("[Payment] Real-time event listeners started (bytes32 version)");
  }

  /**
   * Try to decode bytes32 to string
   * Works for short strings (≤31 bytes) that were padded
   * Returns original bytes32 if decode fails (was hashed)
   */
  private tryDecodeBytes32(bytes32Value: any): string {
    try {
      const hex = String(bytes32Value);
      // Check if it's all zeros (empty)
      if (hex === '0x0000000000000000000000000000000000000000000000000000000000000000') {
        return '';
      }
      return bytes32ToString(hex);
    } catch {
      // If decode fails, return the hex string
      return String(bytes32Value);
    }
  }

  /**
   * Lookup original string ID from database using bytes32 hash
   * Used for IDs that were hashed (>31 bytes)
   */
  private async lookupOriginalId(
    bytes32Hash: string,
    entityType: 'item' | 'order' | 'payment'
  ): Promise<string | null> {
    try {
      // Query database to find record with matching bytes32 hash
      // The worker stores original IDs, so we search by computing hash
      switch (entityType) {
        case 'item': {
          const items = await prisma.itemBlockchain.findMany({
            select: { id: true },
            take: 100,
          });
          for (const item of items) {
            if (invoiceToBytes32(item.id) === bytes32Hash) {
              return item.id;
            }
          }
          break;
        }
        case 'order': {
          const orders = await prisma.orderBlockchain.findMany({
            select: { id: true },
            take: 100,
          });
          for (const order of orders) {
            if (invoiceToBytes32(order.id) === bytes32Hash) {
              return order.id;
            }
          }
          break;
        }
        case 'payment': {
          const payments = await prisma.paymentBlockchain.findMany({
            select: { id: true },
            take: 100,
          });
          for (const payment of payments) {
            if (invoiceToBytes32(payment.id) === bytes32Hash) {
              return payment.id;
            }
          }
          break;
        }
      }
      return null;
    } catch (error) {
      logger.warn(`[Payment] Failed to lookup original ID for ${bytes32Hash}:`, error);
      return null;
    }
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
        `[Payment] Event already processed: ${eventType} ${event.transactionHash}:${event.index}`
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
      logger.info(
        `[Payment] Enriching ${eventType} event data from transaction...`
      );
      eventData = await this.enrichEventDataFromTransaction(
        eventType,
        event,
        eventData
      );

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
        `[Payment] Processed ${eventType} at block ${event.blockNumber}`
      );
    } catch (error: any) {
      logger.error(`[Payment] Error processing ${eventType}:`, {
        message: error?.message,
        stack: error?.stack,
        name: error?.name,
        error: error,
      });
      throw error;
    }
  }

  /**
   * Extract event data based on event type
   * NOTE: Updated for bytes32 contract - all parameters are bytes32
   */
  private extractEventData(eventType: string, event: ethers.EventLog): any {
    const args = event.args;

    switch (eventType) {
      case "OrderCreated":
        // OrderCreated(bytes32 indexed id, bytes32 indexed holderDID, uint8 status, uint256 amount, bytes32 currency, uint256 timestamp)
        return {
          idBytes32: String(args[0]),                      // indexed bytes32
          holderDIDBytes32: String(args[1]),               // indexed bytes32
          status: Number(args[2]),                         // uint8
          amount: Number(args[3]),                         // uint256
          currencyBytes32: String(args[4]),                // bytes32
          currency: this.tryDecodeBytes32(args[4]),
          timestamp: Number(args[5]),                      // uint256
          blockNumber: Number(event.blockNumber),
          transactionHash: event.transactionHash,
        };

      case "OrderStatusChanged":
        // OrderStatusChanged(bytes32 indexed id, uint8 oldStatus, uint8 newStatus, uint256 timestamp)
        return {
          idBytes32: String(args[0]),                      // indexed bytes32
          oldStatus: Number(args[1]),                      // uint8
          newStatus: Number(args[2]),                      // uint8
          timestamp: Number(args[3]),                      // uint256
          blockNumber: Number(event.blockNumber),
          transactionHash: event.transactionHash,
        };

      case "ItemCreated":
        // ItemCreated(bytes32 indexed id, bytes32 indexed vcID, bytes32 issuerDID, bytes32 holderDID, bytes32 vcHash, uint256 price, uint8 itemType, uint256 timestamp)
        return {
          idBytes32: String(args[0]),                      // indexed bytes32
          vcIDBytes32: String(args[1]),                    // indexed bytes32
          issuerDIDBytes32: String(args[2]),               // bytes32
          holderDIDBytes32: String(args[3]),               // bytes32
          vcHashBytes32: String(args[4]),                  // bytes32
          price: Number(args[5]),                          // uint256
          itemType: Number(args[6]),                       // uint8
          timestamp: Number(args[7]),                      // uint256
          blockNumber: Number(event.blockNumber),
          transactionHash: event.transactionHash,
        };

      case "ItemPaid":
        // ItemPaid(bytes32 indexed id, bytes32 indexed vcID, uint256 timestamp)
        return {
          idBytes32: String(args[0]),                      // indexed bytes32
          vcIDBytes32: String(args[1]),                    // indexed bytes32
          timestamp: Number(args[2]),                      // uint256
          blockNumber: Number(event.blockNumber),
          transactionHash: event.transactionHash,
        };

      case "PaymentCreated":
        // PaymentCreated(bytes32 indexed id, bytes32 indexed orderID, bytes32 method, bytes32 status, uint256 amount, uint256 timestamp)
        return {
          idBytes32: String(args[0]),                      // indexed bytes32
          orderIDBytes32: String(args[1]),                 // indexed bytes32
          methodBytes32: String(args[2]),                  // bytes32
          method: this.tryDecodeBytes32(args[2]),
          statusBytes32: String(args[3]),                  // bytes32
          status: this.tryDecodeBytes32(args[3]),
          amount: Number(args[4]),                         // uint256
          timestamp: Number(args[5]),                      // uint256
          blockNumber: Number(event.blockNumber),
          transactionHash: event.transactionHash,
        };

      case "PaymentStatusChanged":
        // PaymentStatusChanged(bytes32 indexed id, bytes32 indexed orderID, bytes32 oldStatus, bytes32 newStatus, uint256 timestamp)
        return {
          idBytes32: String(args[0]),                      // indexed bytes32
          orderIDBytes32: String(args[1]),                 // indexed bytes32
          oldStatusBytes32: String(args[2]),               // bytes32
          oldStatus: this.tryDecodeBytes32(args[2]),
          newStatusBytes32: String(args[3]),               // bytes32
          newStatus: this.tryDecodeBytes32(args[3]),
          timestamp: Number(args[4]),                      // uint256
          blockNumber: Number(event.blockNumber),
          transactionHash: event.transactionHash,
        };

      case "PaymentFailed":
        // PaymentFailed(bytes32 indexed id, bytes32 indexed orderID, bytes32 method, uint256 amount, uint256 timestamp)
        return {
          idBytes32: String(args[0]),                      // indexed bytes32
          orderIDBytes32: String(args[1]),                 // indexed bytes32
          methodBytes32: String(args[2]),                  // bytes32
          method: this.tryDecodeBytes32(args[2]),
          amount: Number(args[3]),                         // uint256
          timestamp: Number(args[4]),                      // uint256
          blockNumber: Number(event.blockNumber),
          transactionHash: event.transactionHash,
        };

      case "PaymentCompleted":
        // PaymentCompleted(bytes32 indexed id, bytes32 indexed orderID, bytes32 method, uint256 amount, uint256 timestamp)
        return {
          idBytes32: String(args[0]),                      // indexed bytes32
          orderIDBytes32: String(args[1]),                 // indexed bytes32
          methodBytes32: String(args[2]),                  // bytes32
          method: this.tryDecodeBytes32(args[2]),
          amount: Number(args[3]),                         // uint256
          timestamp: Number(args[4]),                      // uint256
          blockNumber: Number(event.blockNumber),
          transactionHash: event.transactionHash,
        };

      default:
        logger.warn(`[Payment] Unknown event type: ${eventType}`);
        return {
          blockNumber: Number(event.blockNumber),
          transactionHash: event.transactionHash,
        };
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

      case "PaymentFailed":
        await this.processor.handlePaymentFailed(eventData);
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
