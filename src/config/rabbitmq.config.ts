import amqplib from 'amqplib';

// RabbitMQ Configuration
export const RABBITMQ_CONFIG = {
  url: process.env.RABBITMQ_URL || 'amqp://admin:admin123@localhost:5672',
  reconnectDelay: 5000, // 5 seconds
};

// Exchange and Queue names
export const EXCHANGES = {
  VC_REQUESTS: 'vc.requests.exchange',
  VC_ISSUANCES: 'vc.issuances.exchange',
};

export const QUEUE_PATTERNS = {
  VC_REQUESTS: 'vc.requests',      // Base pattern for requests
  VC_ISSUANCES: 'vc.issuances',    // Base pattern for issuances
};

// Queue Options WITHOUT TTL (messages stay until manually deleted)
export const QUEUE_OPTIONS = {
  durable: true,                      // Queue bertahan setelah restart
  autoDelete: false,                  // Don't auto-delete queue
  maxLength: 10000,                   // Max 10000 messages per queue
};

// Exchange Options
export const EXCHANGE_OPTIONS = {
  durable: true,
  autoDelete: false,
};

// Message Options WITHOUT TTL
export const MESSAGE_OPTIONS = {
  persistent: true,                   // Message persisted to disk
};

// Type definitions
type RabbitConnection = Awaited<ReturnType<typeof amqplib.connect>>;
type RabbitChannel = Awaited<ReturnType<RabbitConnection['createChannel']>>;

// Connection singleton
let connection: RabbitConnection | null = null;
let channel: RabbitChannel | null = null;

/**
 * Get or create RabbitMQ connection
 */
export async function getRabbitMQConnection(): Promise<RabbitConnection> {
  if (!connection) {
    try {
      console.log('🔌 Connecting to RabbitMQ...');
      connection = await amqplib.connect(RABBITMQ_CONFIG.url);
      
      connection.on('error', (err: Error) => {
        console.error('❌ RabbitMQ connection error:', err);
        connection = null;
      });

      connection.on('close', () => {
        console.warn('⚠️  RabbitMQ connection closed');
        connection = null;
      });

      console.log('✅ Connected to RabbitMQ successfully');
    } catch (error) {
      console.error('❌ Failed to connect to RabbitMQ:', error);
      throw error;
    }
  }
  return connection;
}

/**
 * Get or create RabbitMQ channel
 */
export async function getRabbitMQChannel(): Promise<RabbitChannel> {
  if (!channel) {
    const conn = await getRabbitMQConnection();
    channel = await conn.createChannel();
    
    channel.on('error', (err: Error) => {
      console.error('❌ RabbitMQ channel error:', err);
      channel = null;
    });

    channel.on('close', () => {
      console.warn('⚠️  RabbitMQ channel closed');
      channel = null;
    });

    console.log('✅ RabbitMQ channel created');
  }
  return channel;
}

/**
 * Close RabbitMQ connections gracefully
 */
export async function closeRabbitMQ(): Promise<void> {
  try {
    if (channel) {
      await channel.close();
      channel = null;
      console.log('✅ RabbitMQ channel closed');
    }
    
    if (connection) {
      await connection.close();
      connection = null;
      console.log('✅ RabbitMQ connection closed');
    }
  } catch (error) {
    console.error('❌ Error closing RabbitMQ:', error);
  }
}
