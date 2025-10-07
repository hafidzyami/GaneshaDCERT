import amqplib from 'amqplib';
import {
  getRabbitMQChannel,
  EXCHANGES,
  QUEUE_PATTERNS,
  getQueueOptionsWithDLX,
  DLQ_OPTIONS,
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
   * Initialize RabbitMQ - Setup exchanges, DLX, and DLQ
   */
  public async initialize(): Promise<void> {
    try {
      if (this.isInitialized) {
        console.log('ℹ️  RabbitMQ already initialized');
        return;
      }

      console.log('🚀 Initializing RabbitMQ...');
      
      this.channel = await getRabbitMQChannel();

      // Create main exchanges
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

      // Create Dead Letter Exchanges (DLX)
      await this.channel.assertExchange(
        EXCHANGES.VC_REQUESTS_DLX,
        'fanout',
        EXCHANGE_OPTIONS
      );

      await this.channel.assertExchange(
        EXCHANGES.VC_ISSUANCES_DLX,
        'fanout',
        EXCHANGE_OPTIONS
      );

      // Create Dead Letter Queues (DLQ)
      await this.channel.assertQueue(
        QUEUE_PATTERNS.VC_REQUESTS_DLQ,
        DLQ_OPTIONS
      );

      await this.channel.assertQueue(
        QUEUE_PATTERNS.VC_ISSUANCES_DLQ,
        DLQ_OPTIONS
      );

      // Bind DLQs to DLX
      await this.channel.bindQueue(
        QUEUE_PATTERNS.VC_REQUESTS_DLQ,
        EXCHANGES.VC_REQUESTS_DLX,
        '' // Fanout exchange doesn't use routing keys
      );

      await this.channel.bindQueue(
        QUEUE_PATTERNS.VC_ISSUANCES_DLQ,
        EXCHANGES.VC_ISSUANCES_DLX,
        ''
      );

      this.isInitialized = true;
      console.log('✅ RabbitMQ initialized successfully');
      console.log(`   📮 Main Exchanges: ${EXCHANGES.VC_REQUESTS}, ${EXCHANGES.VC_ISSUANCES}`);
      console.log(`   ☠️  Dead Letter Exchanges: ${EXCHANGES.VC_REQUESTS_DLX}, ${EXCHANGES.VC_ISSUANCES_DLX}`);
      console.log(`   🗑️  Dead Letter Queues: ${QUEUE_PATTERNS.VC_REQUESTS_DLQ}, ${QUEUE_PATTERNS.VC_ISSUANCES_DLQ}`);
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
        note: 'Message persists until consumed'
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
        note: 'Message persists until consumed'
      });
    } catch (error) {
      console.error('❌ Failed to send VC Issuance:', error);
      throw error;
    }
  }

  /**
   * Get VC Requests for specific issuer - CONSUME & DELETE PATTERN
   * Messages are consumed and PERMANENTLY deleted after acknowledgment
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

      // Assert queue WITH Dead Letter Exchange
      await this.channel.assertQueue(queueName, getQueueOptionsWithDLX('requests'));

      // Bind queue to exchange with routing key
      await this.channel.bindQueue(queueName, EXCHANGES.VC_REQUESTS, routingKey);

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
          messages.push(content);
          
          // ACK the message - THIS DELETES IT PERMANENTLY
          this.channel.ack(msg);
          
          console.log(`✅ Message consumed and deleted:`, {
            request_id: content.request_id || 'unknown',
            action: 'DELETED from queue'
          });
        } catch (parseError) {
          console.error('❌ Failed to parse message:', parseError);
          console.log('📨 Raw message content:', msg.content.toString());
          
          // NACK with requeue=false - sends to DLX
          this.channel.nack(msg, false, false);
          
          console.log(`☠️  Malformed message sent to Dead Letter Queue`);
        }
      }

      console.log(`📊 Consumed ${messages.length} requests for issuer: ${issuerDid}`);
      console.log(`🗑️  All messages have been PERMANENTLY DELETED from queue`);
      
      return messages;

    } catch (error) {
      console.error('❌ Failed to get VC Requests:', error);
      throw error;
    }
  }

  /**
   * Get VC Issuances for specific holder - CONSUME & DELETE PATTERN
   * Messages are consumed and PERMANENTLY deleted after acknowledgment
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

      // Assert queue WITH Dead Letter Exchange
      await this.channel.assertQueue(queueName, getQueueOptionsWithDLX('issuances'));

      // Bind queue to exchange with routing key
      await this.channel.bindQueue(queueName, EXCHANGES.VC_ISSUANCES, routingKey);

      console.log(`🔍 Consuming VC issuances from queue: ${queueName}`);

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
          messages.push(content);
          
          // ACK the message - THIS DELETES IT PERMANENTLY
          this.channel.ack(msg);
          
          console.log(`✅ Message consumed and deleted:`, {
            issuance_id: content.issuance_id || 'unknown',
            action: 'DELETED from queue'
          });
        } catch (parseError) {
          console.error('❌ Failed to parse message:', parseError);
          console.log('📨 Raw message content:', msg.content.toString());
          
          // NACK with requeue=false - sends to DLX
          this.channel.nack(msg, false, false);
          
          console.log(`☠️  Malformed message sent to Dead Letter Queue`);
        }
      }

      console.log(`📊 Consumed ${messages.length} issuances for holder: ${holderDid}`);
      console.log(`🗑️  All messages have been PERMANENTLY DELETED from queue`);
      
      return messages;

    } catch (error) {
      console.error('❌ Failed to get VC Issuances:', error);
      throw error;
    }
  }

  /**
   * Get messages from Dead Letter Queue (for debugging/monitoring)
   */
  public async getDeadLetterMessages(queueType: 'requests' | 'issuances'): Promise<any[]> {
    try {
      if (!this.channel) {
        this.channel = await getRabbitMQChannel();
      }

      const dlqName = queueType === 'requests' 
        ? QUEUE_PATTERNS.VC_REQUESTS_DLQ 
        : QUEUE_PATTERNS.VC_ISSUANCES_DLQ;

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
      console.error('❌ Failed to get DLQ messages:', error);
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
