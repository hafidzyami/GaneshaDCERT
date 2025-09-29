import amqplib from 'amqplib';
import {
  getRabbitMQChannel,
  EXCHANGES,
  QUEUE_PATTERNS,
  QUEUE_OPTIONS,
  EXCHANGE_OPTIONS,
  MESSAGE_OPTIONS,
} from '../config/rabbitmq.config';

// Type definition
type RabbitChannel = Awaited<ReturnType<Awaited<ReturnType<typeof amqplib.connect>>['createChannel']>>;

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
   * Get channel (for delayed deletion service)
   */
  public async getChannel(): Promise<RabbitChannel> {
    if (!this.channel) {
      this.channel = await getRabbitMQChannel();
    }
    return this.channel;
  }

  /**
   * Initialize RabbitMQ - Setup exchanges
   */
  public async initialize(): Promise<void> {
    try {
      if (this.isInitialized) {
        console.log('ℹ️  RabbitMQ already initialized');
        return;
      }

      console.log('🚀 Initializing RabbitMQ...');
      
      this.channel = await getRabbitMQChannel();

      // Create exchanges
      await this.channel.assertExchange(
        EXCHANGES.VC_REQUESTS,
        'topic',
        EXCHANGE_OPTIONS
      );

      await this.channel.assertExchange(
        EXCHANGES.VC_ISSUANCES,
        'topic',
        EXCHANGE_OPTIONS
      );

      this.isInitialized = true;
      console.log('✅ RabbitMQ initialized successfully');
      console.log(`   📮 Exchange: ${EXCHANGES.VC_REQUESTS}`);
      console.log(`   📮 Exchange: ${EXCHANGES.VC_ISSUANCES}`);
    } catch (error) {
      console.error('❌ Failed to initialize RabbitMQ:', error);
      throw error;
    }
  }

  /**
   * Send VC Request to RabbitMQ
   * @param issuerDid - Issuer DID (routing key)
   * @param message - Request data
   */
  public async sendVCRequest(issuerDid: string, message: any): Promise<void> {
    try {
      if (!this.channel) {
        this.channel = await getRabbitMQChannel();
      }

      const routingKey = `${QUEUE_PATTERNS.VC_REQUESTS}.${issuerDid}`;
      const messageBuffer = Buffer.from(JSON.stringify(message));

      // Publish to exchange with routing key = issuer DID
      this.channel.publish(
        EXCHANGES.VC_REQUESTS,
        routingKey,
        messageBuffer,
        MESSAGE_OPTIONS
      );

      console.log(`📤 VC Request sent:`, {
        exchange: EXCHANGES.VC_REQUESTS,
        routingKey,
        expiresIn: '5 minutes'
      });
    } catch (error) {
      console.error('❌ Failed to send VC Request:', error);
      throw error;
    }
  }

  /**
   * Send VC Issuance to RabbitMQ
   * @param holderDid - Holder DID (routing key)
   * @param message - Issuance data
   */
  public async sendVCIssuance(holderDid: string, message: any): Promise<void> {
    try {
      if (!this.channel) {
        this.channel = await getRabbitMQChannel();
      }

      const routingKey = `${QUEUE_PATTERNS.VC_ISSUANCES}.${holderDid}`;
      const messageBuffer = Buffer.from(JSON.stringify(message));

      // Publish to exchange with routing key = holder DID
      this.channel.publish(
        EXCHANGES.VC_ISSUANCES,
        routingKey,
        messageBuffer,
        MESSAGE_OPTIONS
      );

      console.log(`📤 VC Issuance sent:`, {
        exchange: EXCHANGES.VC_ISSUANCES,
        routingKey,
        expiresIn: '5 minutes'
      });
    } catch (error) {
      console.error('❌ Failed to send VC Issuance:', error);
      throw error;
    }
  }

  /**
   * Get VC Requests for specific issuer
   * Peek at messages WITHOUT consuming them (messages stay in queue)
   * @param issuerDid - Issuer DID
   * @returns Array of VC requests
   */
  public async getVCRequestsByIssuer(issuerDid: string): Promise<any[]> {
    try {
      if (!this.channel) {
        this.channel = await getRabbitMQChannel();
      }

      const queueName = `${QUEUE_PATTERNS.VC_REQUESTS}.${issuerDid}`;
      const routingKey = `${QUEUE_PATTERNS.VC_REQUESTS}.${issuerDid}`;

      // Assert queue WITHOUT TTL
      await this.channel.assertQueue(queueName, QUEUE_OPTIONS);

      // Bind queue to exchange with routing key
      await this.channel.bindQueue(queueName, EXCHANGES.VC_REQUESTS, routingKey);

      console.log(`🔍 Fetching VC requests from queue: ${queueName}`);

      // Check queue status
      const queueInfo = await this.channel.checkQueue(queueName);
      console.log(`📋 Queue has ${queueInfo.messageCount} message(s)`);

      if (queueInfo.messageCount === 0) {
        return [];
      }

      const messages: any[] = [];
      const messagesToRequeue: any[] = [];

      // Consume messages and store them for requeuing
      for (let i = 0; i < queueInfo.messageCount; i++) {
        const msg = await this.channel.get(queueName, { noAck: false });
        
        if (!msg) {
          break;
        }

        try {
          const content = JSON.parse(msg.content.toString());
          messages.push(content);
          messagesToRequeue.push({ msg, content });
          
          // ACK the message first
          this.channel.ack(msg);
          
          console.log(`✅ Message consumed (will republish)`);
        } catch (parseError) {
          console.error('❌ Failed to parse message:', parseError);
          // Reject bad message
          this.channel.nack(msg, false, false);
        }
      }

      // Republish all messages back to queue
      for (const item of messagesToRequeue) {
        const messageBuffer = Buffer.from(JSON.stringify(item.content));
        this.channel.sendToQueue(queueName, messageBuffer, MESSAGE_OPTIONS);
        console.log(`🔄 Message republished to queue`);
      }

      console.log(`📊 Found ${messages.length} requests for issuer: ${issuerDid}`);
      return messages;

    } catch (error) {
      console.error('❌ Failed to get VC Requests:', error);
      throw error;
    }
  }

  /**
   * Get VC Issuances for specific holder
   * Peek at messages WITHOUT consuming them (messages stay in queue)
   * @param holderDid - Holder DID
   * @returns Array of VC issuances
   */
  public async getVCIssuancesByHolder(holderDid: string): Promise<any[]> {
    try {
      if (!this.channel) {
        this.channel = await getRabbitMQChannel();
      }

      const queueName = `${QUEUE_PATTERNS.VC_ISSUANCES}.${holderDid}`;
      const routingKey = `${QUEUE_PATTERNS.VC_ISSUANCES}.${holderDid}`;

      // Assert queue WITHOUT TTL
      await this.channel.assertQueue(queueName, QUEUE_OPTIONS);

      // Bind queue to exchange with routing key
      await this.channel.bindQueue(queueName, EXCHANGES.VC_ISSUANCES, routingKey);

      console.log(`🔍 Fetching VC issuances from queue: ${queueName}`);

      // Check queue status
      const queueInfo = await this.channel.checkQueue(queueName);
      console.log(`📋 Queue has ${queueInfo.messageCount} message(s)`);

      if (queueInfo.messageCount === 0) {
        return [];
      }

      const messages: any[] = [];
      const messagesToRequeue: any[] = [];

      // Consume messages and store them for requeuing
      for (let i = 0; i < queueInfo.messageCount; i++) {
        const msg = await this.channel.get(queueName, { noAck: false });
        
        if (!msg) {
          break;
        }

        try {
          const content = JSON.parse(msg.content.toString());
          messages.push(content);
          messagesToRequeue.push({ msg, content });
          
          // ACK the message first
          this.channel.ack(msg);
          
          console.log(`✅ Message consumed (will republish)`);
        } catch (parseError) {
          console.error('❌ Failed to parse message:', parseError);
          // Reject bad message
          this.channel.nack(msg, false, false);
        }
      }

      // Republish all messages back to queue
      for (const item of messagesToRequeue) {
        const messageBuffer = Buffer.from(JSON.stringify(item.content));
        this.channel.sendToQueue(queueName, messageBuffer, MESSAGE_OPTIONS);
        console.log(`🔄 Message republished to queue`);
      }

      console.log(`📊 Found ${messages.length} issuances for holder: ${holderDid}`);
      return messages;

    } catch (error) {
      console.error('❌ Failed to get VC Issuances:', error);
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
