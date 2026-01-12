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
  private lastProcessedBlock: { [eventType: string]: number } = {};

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
      const tx = await PaymentBlockchainConfig.provider.getTransaction(
        eventLog.transactionHash
      );
      if (!tx) {
        logger.warn(
          `[Payment] Transaction not found: ${eventLog.transactionHash}`
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
          `[Payment] Could not decode transaction data for ${eventLog.transactionHash}`
        );
        return eventData;
      }

      logger.info(
        `[Payment] Decoded transaction function: ${decodedData.name}`
      );

      // Extract actual values from function arguments
      switch (eventType) {
        case "OrderCreated":
          // event OrderCreated(string indexed id, string indexed holderDID, uint8 status, uint256 amount, string currency, uint256 timestamp)
          // createOrder(string _id, string _holderDID, uint256 _amount, string _currency, string[] _items)
          if (decodedData.name === "createOrder") {
            return {
              id: String(decodedData.args[0]),          // _id
              holderDID: String(decodedData.args[1]),   // _holderDID
              amount: Number(decodedData.args[2]),      // _amount (args[2], not args[3]!)
              currency: String(decodedData.args[3]),    // _currency (args[3], not args[2]!)
              status: eventData.status,                 // from event (uint8)
              timestamp: eventData.timestamp,           // from event (uint256)
              blockNumber: eventData.blockNumber,
              transactionHash: eventData.transactionHash,
            };
          }
          break;

        case "OrderStatusChanged":
          // event OrderStatusChanged(string indexed id, uint8 oldStatus, uint8 newStatus, uint256 timestamp)
          // updateOrderStatus(string _orderId, uint _newStatus)
          if (decodedData.name === "updateOrderStatus") {
            return {
              id: String(decodedData.args[0]),          // _orderId
              newStatus: Number(decodedData.args[1]),   // _newStatus
              oldStatus: eventData.oldStatus,           // from event
              timestamp: eventData.timestamp,           // from event
              blockNumber: eventData.blockNumber,
              transactionHash: eventData.transactionHash,
            };
          }
          break;

        case "ItemCreated":
          // event ItemCreated(string indexed id, string indexed vcID, string vcHash, uint256 price, uint8 itemType, uint256 timestamp)
          // createItem(string _id, uint256 _price, string _vcID, string _vcHash, uint8 _itemType)
          if (decodedData.name === "createItem") {
            return {
              id: String(decodedData.args[0]),          // _id
              vcID: String(decodedData.args[2]),        // _vcID (args[2], not args[1]!)
              vcHash: String(decodedData.args[3]),      // _vcHash (args[3], not args[2]!)
              price: Number(decodedData.args[1]),       // _price (args[1], not args[3]!)
              itemType: Number(decodedData.args[4]),    // _itemType
              timestamp: eventData.timestamp,           // from event (uint256)
              blockNumber: eventData.blockNumber,
              transactionHash: eventData.transactionHash,
            };
          }
          break;

        case "ItemPaid":
          // event ItemPaid(string indexed id, string indexed vcID, uint256 timestamp)
          // markItemAsPaid(string _itemId) - only has itemId parameter
          if (decodedData.name === "markItemAsPaid") {
            const itemId = String(decodedData.args[0]);

            // vcID is indexed but not in function params, need to query blockchain
            let vcID = eventData.vcID;
            try {
              const itemData = await this.contract.getItem(itemId);
              vcID = String(itemData.vcID);
              logger.debug(
                `[Payment] Fetched vcID from blockchain for item ${itemId}: ${vcID}`
              );
            } catch (error) {
              logger.warn(
                `[Payment] Could not fetch item data for ${itemId}, using event vcID:`,
                error
              );
            }

            return {
              id: itemId, // indexed - from tx
              vcID: vcID, // indexed - from blockchain query
              timestamp: eventData.timestamp, // NOT indexed - from event
              blockNumber: eventData.blockNumber,
              transactionHash: eventData.transactionHash,
            };
          }
          break;

        case "PaymentCreated":
          // event PaymentCreated(string indexed id, string indexed orderID, string method, string status, uint256 amount, uint256 timestamp)
          // createPayment(string _id, string _orderID, string _method, string _status, uint256 _amount)
          if (decodedData.name === "createPayment") {
            return {
              id: String(decodedData.args[0]),        // _id
              orderID: String(decodedData.args[1]),   // _orderID
              method: String(decodedData.args[2]),    // _method (from tx, not event!)
              status: String(decodedData.args[3]),    // _status (from tx, not event!)
              amount: Number(decodedData.args[4]),    // _amount (from tx, not event!)
              timestamp: eventData.timestamp,         // from event (not in function params)
              blockNumber: eventData.blockNumber,
              transactionHash: eventData.transactionHash,
            };
          }
          break;

        case "PaymentStatusChanged":
          // event PaymentStatusChanged(string indexed id, string indexed orderID, string oldStatus, string newStatus, uint256 timestamp)
          // updatePaymentStatus(string _paymentId, string _newStatus)
          if (decodedData.name === "updatePaymentStatus") {
            const paymentId = String(decodedData.args[0]);

            // orderID is indexed but not in function params, need to query blockchain
            let orderID = eventData.orderID;
            try {
              const paymentData = await this.contract.getPayment(paymentId);
              orderID = String(paymentData.orderID);
              logger.debug(
                `[Payment] Fetched orderID from blockchain for payment ${paymentId}: ${orderID}`
              );
            } catch (error) {
              logger.warn(
                `[Payment] Could not fetch payment data for ${paymentId}, using event orderID:`,
                error
              );
            }

            return {
              id: paymentId, // indexed - from tx
              orderID: orderID, // indexed - from blockchain query
              oldStatus: eventData.oldStatus, // NOT indexed - from event
              newStatus: eventData.newStatus, // NOT indexed - from event
              timestamp: eventData.timestamp, // NOT indexed - from event
              blockNumber: eventData.blockNumber,
              transactionHash: eventData.transactionHash,
            };
          }
          break;

        case "PaymentCompleted":
          // event PaymentCompleted(string indexed id, string indexed orderID, uint256 amount, uint256 timestamp)
          // completePayment(string _paymentId, string _orderId, string _successStatus)
          if (decodedData.name === "completePayment") {
            return {
              id: String(decodedData.args[0]),        // _paymentId
              orderID: String(decodedData.args[1]),   // _orderId
              amount: eventData.amount,               // from event (not in function params)
              timestamp: eventData.timestamp,         // from event (not in function params)
              blockNumber: eventData.blockNumber,
              transactionHash: eventData.transactionHash,
            };
          }
          break;
      }

      // If no match, return original eventData
      logger.warn(
        `[Payment] No enrichment pattern for ${eventType} with function ${decodedData.name}`
      );
      return eventData;
    } catch (error: any) {
      logger.error(
        `[Payment] Error enriching event data from transaction:`,
        {
          message: error?.message,
          stack: error?.stack,
          name: error?.name,
          eventType: eventType,
          transactionHash: eventLog.transactionHash,
          error: error,
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
   */
  private listenToRealtimeEvents(): void {
    logger.info("[Payment] Starting real-time event listeners...");

    this.contract.on(
      "OrderCreated",
      async (id, holderDID, status, amount, currency, timestamp, event) => {
        try {
          const eventLog = event.log as ethers.EventLog;
          // Don't convert indexed strings - they're hashes and will be enriched later
          const eventData = {
            id: id,                       // indexed - will be hash, enriched from tx
            holderDID: holderDID,         // indexed - will be hash, enriched from tx
            status: Number(status),       // not indexed uint - safe to convert
            amount: Number(amount),       // not indexed uint - safe to convert
            currency: String(currency),   // not indexed - safe to convert
            timestamp: Number(timestamp), // not indexed uint - safe to convert
            blockNumber: Number(eventLog.blockNumber),
            transactionHash: eventLog.transactionHash,
          };
          await this.processEvent("OrderCreated", eventLog, eventData);
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
          const eventData = {
            id: id,                       // indexed - will be hash, enriched from tx
            oldStatus: Number(oldStatus), // not indexed uint - safe to convert
            newStatus: Number(newStatus), // not indexed uint - safe to convert
            timestamp: Number(timestamp), // not indexed uint - safe to convert
            blockNumber: Number(eventLog.blockNumber),
            transactionHash: eventLog.transactionHash,
          };
          await this.processEvent("OrderStatusChanged", eventLog, eventData);
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
          // Don't convert indexed strings - they're hashes and will be enriched later
          const eventData = {
            id: id,                       // indexed - will be hash, enriched from tx
            vcID: vcID,                   // indexed - will be hash, enriched from tx
            vcHash: String(vcHash),       // not indexed - safe to convert
            price: Number(price),         // not indexed uint - safe to convert
            itemType: Number(itemType),   // not indexed uint - safe to convert
            timestamp: Number(timestamp), // not indexed uint - safe to convert
            blockNumber: Number(eventLog.blockNumber),
            transactionHash: eventLog.transactionHash,
          };
          await this.processEvent("ItemCreated", eventLog, eventData);
        } catch (error) {
          logger.error("[Payment] Error processing ItemCreated:", error);
        }
      }
    );

    this.contract.on("ItemPaid", async (id, vcID, timestamp, event) => {
      try {
        const eventLog = event.log as ethers.EventLog;
        const eventData = {
          id: id,                       // indexed - will be hash, enriched from tx
          vcID: vcID,                   // indexed - will be hash, enriched from tx
          timestamp: Number(timestamp), // not indexed uint - safe to convert
          blockNumber: Number(eventLog.blockNumber),
          transactionHash: eventLog.transactionHash,
        };
        await this.processEvent("ItemPaid", eventLog, eventData);
      } catch (error) {
        logger.error("[Payment] Error processing ItemPaid:", error);
      }
    });

    this.contract.on(
      "PaymentCreated",
      async (id, orderID, method, status, amount, timestamp, event) => {
        try {
          const eventLog = event.log as ethers.EventLog;
          const eventData = {
            id: id,                       // indexed - will be hash, enriched from tx
            orderID: orderID,             // indexed - will be hash, enriched from tx
            method: String(method),       // not indexed - safe to convert
            status: String(status),       // not indexed - safe to convert
            amount: Number(amount),       // not indexed uint - safe to convert
            timestamp: Number(timestamp), // not indexed uint - safe to convert
            blockNumber: Number(eventLog.blockNumber),
            transactionHash: eventLog.transactionHash,
          };
          await this.processEvent("PaymentCreated", eventLog, eventData);
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
          const eventData = {
            id: id,                       // indexed - will be hash, enriched from tx
            orderID: orderID,             // indexed - will be hash, enriched from tx
            oldStatus: String(oldStatus), // not indexed - safe to convert
            newStatus: String(newStatus), // not indexed - safe to convert
            timestamp: Number(timestamp), // not indexed uint - safe to convert
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

    this.contract.on(
      "PaymentCompleted",
      async (id, orderID, amount, timestamp, event) => {
        try {
          const eventLog = event.log as ethers.EventLog;
          const eventData = {
            id: id,                       // indexed - will be hash, enriched from tx
            orderID: orderID,             // indexed - will be hash, enriched from tx
            amount: Number(amount),       // not indexed uint - safe to convert
            timestamp: Number(timestamp), // not indexed uint - safe to convert
            blockNumber: Number(eventLog.blockNumber),
            transactionHash: eventLog.transactionHash,
          };
          await this.processEvent("PaymentCompleted", eventLog, eventData);
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
   * Note: Indexed strings will be hashed - enrichment happens later via enrichEventDataFromTransaction
   */
  private extractEventData(eventType: string, event: ethers.EventLog): any {
    const args = event.args;

    switch (eventType) {
      case "OrderCreated":
        return {
          id: String(args[0]),
          holderDID: String(args[1]),
          status: Number(args[2]),
          amount: Number(args[3]),
          currency: String(args[4]),
          timestamp: Number(args[5]),
          blockNumber: Number(event.blockNumber),
          transactionHash: event.transactionHash,
        };

      case "OrderStatusChanged":
        return {
          id: String(args[0]),
          oldStatus: Number(args[1]),
          newStatus: Number(args[2]),
          timestamp: Number(args[3]),
          blockNumber: Number(event.blockNumber),
          transactionHash: event.transactionHash,
        };

      case "ItemCreated":
        return {
          id: String(args[0]),
          vcID: String(args[1]),
          vcHash: String(args[2]),
          price: Number(args[3]),
          itemType: Number(args[4]),
          timestamp: Number(args[5]),
          blockNumber: Number(event.blockNumber),
          transactionHash: event.transactionHash,
        };

      case "ItemPaid":
        return {
          id: String(args[0]),
          vcID: String(args[1]),
          timestamp: Number(args[2]),
          blockNumber: Number(event.blockNumber),
          transactionHash: event.transactionHash,
        };

      case "PaymentCreated":
        return {
          id: String(args[0]),
          orderID: String(args[1]),
          method: String(args[2]),
          status: String(args[3]),
          amount: Number(args[4]),
          timestamp: Number(args[5]),
          blockNumber: Number(event.blockNumber),
          transactionHash: event.transactionHash,
        };

      case "PaymentStatusChanged":
        return {
          id: String(args[0]),
          orderID: String(args[1]),
          oldStatus: String(args[2]),
          newStatus: String(args[3]),
          timestamp: Number(args[4]),
          blockNumber: Number(event.blockNumber),
          transactionHash: event.transactionHash,
        };

      case "PaymentCompleted":
        return {
          id: String(args[0]),
          orderID: String(args[1]),
          amount: Number(args[2]),
          timestamp: Number(args[3]),
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
