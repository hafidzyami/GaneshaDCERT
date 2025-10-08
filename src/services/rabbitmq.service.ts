import amqplib from "amqplib";
import {
  getRabbitMQChannel,
  EXCHANGES,
  QUEUE_PATTERNS,
  getQueueOptionsWithDLX,
  DLQ_OPTIONS,
  EXCHANGE_OPTIONS,
  MESSAGE_OPTIONS,
} from "../config/rabbitmq.config";

// Type definition
type RabbitChannel = Awaited<
  ReturnType<Awaited<ReturnType<typeof amqplib.connect>>["createChannel"]>
>;

class RabbitMQService {
  private static instance: RabbitMQService;
  private channel: RabbitChannel | null = null;
  private isInitialized: boolean = false;

  private constructor() {}

  public static getInstance(): RabbitMQService {
    if (!RabbitMQService.instance) {
      RabbitMQService.instance = new RabbitMQService();
    }
    return RabbitMQService.instance;
  }

  /**
   * Initialize RabbitMQ - Setup exchanges, DLX, and DLQ
   */
  public async initialize(): Promise<void> {
    try {
      if (this.isInitialized) {
        console.log("ℹ️  RabbitMQ already initialized");
        return;
      }

      console.log("🚀 Initializing RabbitMQ...");

      this.channel = await getRabbitMQChannel();

      // Create main exchange for requests (Topic Exchange)
      await this.channel.assertExchange(
        EXCHANGES.VC_REQUESTS,
        "topic",
        EXCHANGE_OPTIONS
      );

      // Create Dead Letter Exchange (DLX) for requests
      await this.channel.assertExchange(
        EXCHANGES.VC_REQUESTS_DLX,
        "fanout",
        EXCHANGE_OPTIONS
      );

      // Create Dead Letter Queue (DLQ) for requests
      await this.channel.assertQueue(
        QUEUE_PATTERNS.VC_REQUESTS_DLQ,
        DLQ_OPTIONS
      );

      // Bind DLQ to DLX
      await this.channel.bindQueue(
        QUEUE_PATTERNS.VC_REQUESTS_DLQ,
        EXCHANGES.VC_REQUESTS_DLX,
        "" // Fanout exchange doesn't use routing keys
      );

      this.isInitialized = true;
      console.log("✅ RabbitMQ initialized successfully");
      console.log(`   📮 Request Exchange: ${EXCHANGES.VC_REQUESTS} (Topic)`);
      console.log(`   ☠️  Dead Letter Exchange: ${EXCHANGES.VC_REQUESTS_DLX}`);
      console.log(
        `   🗑️  Dead Letter Queue: ${QUEUE_PATTERNS.VC_REQUESTS_DLQ}`
      );
      console.log(
        `   💡 Responses use Direct Reply-to pattern (no exchange needed)`
      );
    } catch (error) {
      console.error("❌ Failed to initialize RabbitMQ:", error);
      throw error;
    }
  }

  /**
   * Send VC Request to RabbitMQ with Direct Reply-to pattern
   * @param issuerDid - Issuer DID (routing key)
   * @param message - Request data
   * @param replyTo - Reply queue name for Direct Reply-to
   * @param correlationId - Unique ID to correlate request-response
   */
  public async sendVCRequest(
    issuerDid: string,
    message: any,
    replyTo: string,
    correlationId: string
  ): Promise<void> {
    try {
      if (!this.channel) {
        this.channel = await getRabbitMQChannel();
      }

      const routingKey = `${QUEUE_PATTERNS.VC_REQUESTS}.${issuerDid}`;
      const messageBuffer = Buffer.from(JSON.stringify(message));

      // Publish with replyTo and correlationId for Direct Reply-to pattern
      this.channel.publish(EXCHANGES.VC_REQUESTS, routingKey, messageBuffer, {
        ...MESSAGE_OPTIONS,
        replyTo,
        correlationId,
      });

      console.log(`📤 VC Request sent:`, {
        exchange: EXCHANGES.VC_REQUESTS,
        routingKey,
        replyTo,
        correlationId,
        note: "Using Direct Reply-to pattern",
      });
    } catch (error) {
      console.error("❌ Failed to send VC Request:", error);
      throw error;
    }
  }

  /**
   * Send VC Issuance using Direct Reply-to pattern
   * This sends directly to the reply queue using Default Exchange
   * @param replyToQueue - The reply queue name from the request
   * @param correlationId - The correlation ID from the request
   * @param message - Issuance data
   */
  public async sendVCIssuance(
    replyToQueue: string | undefined,
    correlationId: string | undefined,
    message: any
  ): Promise<void> {
    try {
      if (!this.channel) {
        this.channel = await getRabbitMQChannel();
      }

      if (!replyToQueue) {
        console.error(
          "❌ Failed to send VC Issuance: replyToQueue is undefined"
        );
        throw new Error(
          "replyToQueue cannot be undefined when sending an issuance."
        );
      }

      const messageBuffer = Buffer.from(JSON.stringify(message));

      // Publish to Default Exchange (empty string) with replyToQueue as routing key
      this.channel.publish(
        "", // Default Exchange
        replyToQueue, // Routing key = queue name
        messageBuffer,
        {
          ...MESSAGE_OPTIONS,
          correlationId,
        }
      );

      console.log(`📤 VC Issuance sent via Direct Reply-to:`, {
        replyToQueue,
        correlationId,
        note: "Sent to default exchange (Direct Reply-to pattern)",
      });
    } catch (error) {
      console.error("❌ Failed to send VC Issuance:", error);
      throw error;
    }
  }

  /**
   * Get VC Requests for specific issuer - CONSUME & DELETE PATTERN
   * Messages are consumed and PERMANENTLY deleted after acknowledgment
   * @param issuerDid - Issuer DID
   * @returns Array of VC requests with reply metadata
   */
  public async getVCRequestsByIssuer(issuerDid: string): Promise<any[]> {
    try {
      if (!this.channel) {
        this.channel = await getRabbitMQChannel();
      }

      const queueName = `${QUEUE_PATTERNS.VC_REQUESTS}.${issuerDid}`;
      const routingKey = `${QUEUE_PATTERNS.VC_REQUESTS}.${issuerDid}`;

      // Assert queue WITH Dead Letter Exchange
      await this.channel.assertQueue(queueName, getQueueOptionsWithDLX());

      // Bind queue to exchange with routing key
      await this.channel.bindQueue(
        queueName,
        EXCHANGES.VC_REQUESTS,
        routingKey
      );

      console.log(`🔍 Consuming VC requests from queue: ${queueName}`);

      // Check queue status
      const queueInfo = await this.channel.checkQueue(queueName);
      console.log(`📋 Queue has ${queueInfo.messageCount} message(s)`);

      if (queueInfo.messageCount === 0) {
        return [];
      }

      const messages: any[] = [];

      // Consume ALL messages and delete them permanently
      for (let i = 0; i < queueInfo.messageCount; i++) {
        const msg = await this.channel.get(queueName, { noAck: false });

        if (!msg) {
          break;
        }

        try {
          // Parse message content
          const content = JSON.parse(msg.content.toString());

          // Include reply metadata for Direct Reply-to
          const requestWithReplyInfo = {
            ...content,
            _replyTo: msg.properties.replyTo,
            _correlationId: msg.properties.correlationId,
          };

          messages.push(requestWithReplyInfo);

          // ACK the message - THIS DELETES IT PERMANENTLY
          this.channel.ack(msg);

          console.log(`✅ Message consumed and deleted:`, {
            request_id: content.request_id || "unknown",
            replyTo: msg.properties.replyTo,
            correlationId: msg.properties.correlationId,
            action: "DELETED from queue",
          });
        } catch (parseError) {
          console.error("❌ Failed to parse message:", parseError);
          console.log("📨 Raw message content:", msg.content.toString());

          // NACK with requeue=false - sends to DLX
          this.channel.nack(msg, false, false);

          console.log(`☠️  Malformed message sent to Dead Letter Queue`);
        }
      }

      console.log(
        `📊 Consumed ${messages.length} requests for issuer: ${issuerDid}`
      );
      console.log(`🗑️  All messages have been PERMANENTLY DELETED from queue`);

      return messages;
    } catch (error) {
      console.error("❌ Failed to get VC Requests:", error);
      throw error;
    }
  }

  /**
   * Create and listen to a reply queue for Direct Reply-to pattern
   * This is used by the Holder to wait for responses
   * @param replyQueueName - Unique reply queue name
   * @param correlationId - Expected correlation ID
   * @param timeoutMs - Timeout in milliseconds (default: 30000)
   * @returns Promise that resolves with the response message
   */
  public async waitForReply(
    replyQueueName: string,
    correlationId: string,
    timeoutMs: number = 30000
  ): Promise<any> {
    try {
      if (!this.channel) {
        this.channel = await getRabbitMQChannel();
      }

      // Assert exclusive, auto-delete queue for reply
      await this.channel.assertQueue(replyQueueName, {
        exclusive: true,
        autoDelete: true,
        durable: false,
      });

      console.log(`👂 Waiting for reply on queue: ${replyQueueName}`);
      console.log(`   Correlation ID: ${correlationId}`);
      console.log(`   Timeout: ${timeoutMs}ms`);

      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error(`Timeout waiting for reply after ${timeoutMs}ms`));
        }, timeoutMs);

        // Consume messages from reply queue
        this.channel!.consume(
          replyQueueName,
          (msg) => {
            if (!msg) {
              clearTimeout(timeout);
              reject(new Error("Consumer cancelled"));
              return;
            }

            // Check if correlation ID matches
            if (msg.properties.correlationId === correlationId) {
              clearTimeout(timeout);

              try {
                const response = JSON.parse(msg.content.toString());
                this.channel!.ack(msg);

                console.log(`✅ Received reply:`, {
                  correlationId: msg.properties.correlationId,
                  issuance_id: response.issuance_id || "unknown",
                });

                resolve(response);
              } catch (error) {
                this.channel!.nack(msg, false, false);
                reject(new Error("Failed to parse reply message"));
              }
            } else {
              // Wrong correlation ID, reject and requeue
              console.warn(
                `⚠️  Received message with wrong correlation ID: ${msg.properties.correlationId}`
              );
              this.channel!.nack(msg, false, true);
            }
          },
          { noAck: false }
        );
      });
    } catch (error) {
      console.error("❌ Failed to wait for reply:", error);
      throw error;
    }
  }

  /**
   * Get messages from Dead Letter Queue (for debugging/monitoring)
   */
  public async getDeadLetterMessages(): Promise<any[]> {
    try {
      if (!this.channel) {
        this.channel = await getRabbitMQChannel();
      }

      const dlqName = QUEUE_PATTERNS.VC_REQUESTS_DLQ;

      console.log(`🔍 Checking Dead Letter Queue: ${dlqName}`);

      const queueInfo = await this.channel.checkQueue(dlqName);
      console.log(`☠️  DLQ has ${queueInfo.messageCount} failed message(s)`);

      const messages: any[] = [];

      // Peek at DLQ messages (don't consume them)
      for (let i = 0; i < Math.min(queueInfo.messageCount, 100); i++) {
        const msg = await this.channel.get(dlqName, { noAck: true });

        if (!msg) {
          break;
        }

        messages.push({
          raw: msg.content.toString(),
          headers: msg.properties.headers,
          timestamp: msg.properties.timestamp,
        });
      }

      return messages;
    } catch (error) {
      console.error("❌ Failed to get DLQ messages:", error);
      throw error;
    }
  }

  /**
   * Get connection status
   */
  public get isConnected(): boolean {
    return this.isInitialized && this.channel !== null;
  }
}

export const rabbitmqService = RabbitMQService.getInstance();
export default rabbitmqService;
