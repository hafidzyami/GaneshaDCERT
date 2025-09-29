import { Kafka, KafkaConfig } from 'kafkajs';

// Load environment variables
require('dotenv').config();

// Konfigurasi Kafka untuk single node (official Apache Kafka)
const kafkaConfig: KafkaConfig = {
  clientId: process.env.KAFKA_CLIENT_ID || 'ganesha-dcert-app',
  brokers: process.env.KAFKA_BROKERS?.split(',') || ['localhost:9092'],
  // Konfigurasi untuk development
  connectionTimeout: 10000,
  requestTimeout: 30000,
  retry: {
    initialRetryTime: 300,
    retries: 8,
    maxRetryTime: 30000,
    factor: 2
  }
};

// Inisialisasi Kafka Client
export const KafkaClient = new Kafka(kafkaConfig);

// Producer untuk single node
export const kafkaProducer = KafkaClient.producer({
  maxInFlightRequests: 1,
  idempotent: false, // Disable untuk single node
  transactionTimeout: 30000,
  allowAutoTopicCreation: true
});

// Admin client 
export const kafkaAdmin = KafkaClient.admin({
  retry: {
    initialRetryTime: 300,
    retries: 10,
    maxRetryTime: 30000,
    factor: 2
  }
});

// Konstanta untuk topic names
export const KAFKA_TOPICS = {
  VC_REQUESTS: 'vc_requests',
  VC_ISSUANCES: 'vc_issuances'
} as const;

// Konfigurasi topics untuk single node
export const TOPIC_CONFIG = {
  numPartitions: 3,
  replicationFactor: 1, // Single node = replication factor 1
  minInSyncReplicas: 1  // Single node = min ISR 1
};

// Environment detection
export const KAFKA_ENV = {
  BROKERS: process.env.KAFKA_BROKERS?.split(',') || ['localhost:9092'],
  CLIENT_ID: process.env.KAFKA_CLIENT_ID || 'ganesha-dcert-app',
  SINGLE_NODE: true
};

console.log('🔧 Kafka Configuration (Apache Kafka Official):', {
  brokers: KAFKA_ENV.BROKERS,
  clientId: KAFKA_ENV.CLIENT_ID,
  mode: 'Single Node (Apache Kafka Official)',
  replicationFactor: TOPIC_CONFIG.replicationFactor
});
