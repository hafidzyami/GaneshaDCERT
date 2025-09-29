import { Consumer } from 'kafkajs';
import { KafkaClient, KAFKA_TOPICS } from './config/kafka.config';

class KafkaConsumerWorker {
  private consumer: Consumer;
  private isConnected: boolean = false;

  constructor() {
    this.consumer = KafkaClient.consumer({ 
      groupId: 'request-processors',
      sessionTimeout: 30000,
      rebalanceTimeout: 60000,
      heartbeatInterval: 3000,
      maxBytesPerPartition: 1048576, // 1MB
      minBytes: 1,
      maxBytes: 10485760, // 10MB
      maxWaitTimeInMs: 5000,
      allowAutoTopicCreation: true,
      retry: {
        initialRetryTime: 100,
        retries: 8
      }
    });
  }

  /**
   * Connect consumer dan subscribe ke topics
   */
  public async connect(): Promise<void> {
    try {
      console.log('🔌 Connecting Kafka Consumer Worker to single node...');
      
      await this.consumer.connect();
      this.isConnected = true;
      
      await this.consumer.subscribe({ 
        topic: KAFKA_TOPICS.VC_REQUESTS,
        fromBeginning: false // Set to true if you want to consume from beginning
      });
      
      console.log(`✅ Consumer connected to single node and subscribed to topic: ${KAFKA_TOPICS.VC_REQUESTS}`);
      console.log('🎯 Consumer Group: request-processors');
    } catch (error) {
      console.error('❌ Failed to connect consumer:', error);
      throw error;
    }
  }

  /**
   * Mulai proses consumer
   */
  public async startConsuming(): Promise<void> {
    try {
      console.log('🎯 Starting to consume messages from single Kafka node...');
      
      await this.consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
          try {
            // Parsing message
            const messageKey = message.key?.toString() || 'no-key';
            const messageValue = message.value?.toString();
            const messageHeaders = message.headers || {};
            
            if (!messageValue) {
              console.warn('⚠️ Received empty message, skipping...');
              return;
            }

            // Parse JSON message
            const parsedMessage = JSON.parse(messageValue);
            
            // Format headers untuk display
            const formattedHeaders: Record<string, string> = {};
            Object.keys(messageHeaders).forEach(key => {
              const headerValue = messageHeaders[key];
              formattedHeaders[key] = headerValue?.toString() || '';
            });

            // Log message yang diterima dengan format yang jelas
            console.log('\n' + '='.repeat(80));
            console.log('📨 NEW MESSAGE RECEIVED FROM KAFKA');
            console.log('='.repeat(80));
            console.log(`🏷️  Topic: ${topic}`);
            console.log(`📍 Partition: ${partition}`);
            console.log(`🔑 Message Key: ${messageKey}`);
            console.log(`⏰ Timestamp: ${message.timestamp ? new Date(parseInt(message.timestamp)).toISOString() : 'N/A'}`);
            console.log(`📦 Offset: ${message.offset}`);
            console.log(`🏢 Consumer Group: request-processors`);
            console.log('📋 Headers:', JSON.stringify(formattedHeaders, null, 2));
            console.log('📄 Message Content:');
            console.log(JSON.stringify(parsedMessage, null, 2));
            console.log('='.repeat(80) + '\n');

            // Proses message berdasarkan jenis credential
            await this.processVCRequest(parsedMessage, messageKey, {
              topic,
              partition: partition.toString(),
              offset: message.offset,
              timestamp: message.timestamp
            });

          } catch (parseError) {
            console.error('❌ Error processing message:', parseError);
            console.error('🔍 Raw message value:', message.value?.toString());
            // Dalam production, Anda mungkin ingin mengirim ke dead letter queue
          }
        },
      });
    } catch (error) {
      console.error('❌ Error in consumer run:', error);
      throw error;
    }
  }

  /**
   * Process VC Request message
   */
  private async processVCRequest(vcRequest: any, key: string, metadata: any): Promise<void> {
    try {
      console.log(`🔄 Processing VC Request: ${vcRequest.request_id || 'unknown'}`);
      console.log(`🎯 Processing on partition ${metadata.partition}`);
      
      // Simulasi pemrosesan request
      // Di implementasi nyata, di sini Anda akan:
      // 1. Validasi data request
      // 2. Generate credential
      // 3. Store ke database
      // 4. Send response ke topic vc_issuances
      
      console.log(`✅ Request processed for issuer: ${vcRequest.issuer_id}`);
      console.log(`📝 Credential type: ${vcRequest.credential_type}`);
      console.log(`👤 Holder ID: ${vcRequest.holder_id}`);
      
      // Simulasi delay processing
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      console.log(`✅ VC Request processing completed for: ${vcRequest.request_id || 'unknown'}`);
      console.log(`📊 Message processed by consumer group: request-processors`);
      
    } catch (error) {
      console.error(`❌ Error processing VC Request:`, error);
    }
  }

  /**
   * Disconnect consumer
   */
  public async disconnect(): Promise<void> {
    try {
      if (this.isConnected) {
        console.log('🔌 Disconnecting consumer from Kafka...');
        await this.consumer.disconnect();
        this.isConnected = false;
        console.log('✅ Consumer disconnected successfully');
      }
    } catch (error) {
      console.error('❌ Error disconnecting consumer:', error);
    }
  }

  /**
   * Get connection status
   */
  public get connectionStatus(): boolean {
    return this.isConnected;
  }
}

// Main worker function
async function main() {
  const worker = new KafkaConsumerWorker();

  // Graceful shutdown handlers
  const shutdown = async (signal: string) => {
    console.log(`\n🛑 Received ${signal}, shutting down worker gracefully...`);
    await worker.disconnect();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGQUIT', () => shutdown('SIGQUIT'));

  try {
    console.log('🚀 Starting Kafka Consumer Worker (Single Node Mode)...');
    console.log(`📋 Consumer Group: request-processors`);
    console.log(`🎯 Target Topic: ${KAFKA_TOPICS.VC_REQUESTS}`);
    console.log('🏢 Kafka Node: localhost:9092');
    console.log('⏳ Initializing connection...\n');

    await worker.connect();
    await worker.startConsuming();
    
  } catch (error) {
    console.error('❌ Worker failed to start:', error);
    process.exit(1);
  }
}

// Error handling untuk uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the worker
if (require.main === module) {
  main().catch((error) => {
    console.error('❌ Failed to start worker:', error);
    process.exit(1);
  });
}

export default KafkaConsumerWorker;
