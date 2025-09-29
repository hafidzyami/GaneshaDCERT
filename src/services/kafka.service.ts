import { Producer, Admin } from 'kafkajs';
import { KafkaClient, kafkaProducer, kafkaAdmin, KAFKA_TOPICS, TOPIC_CONFIG } from '../config/kafka.config';

class KafkaService {
  private static instance: KafkaService;
  private producer: Producer;
  private admin: Admin;
  private isProducerConnected: boolean = false;
  private isAdminConnected: boolean = false;

  private constructor() {
    this.producer = kafkaProducer;
    this.admin = kafkaAdmin;
  }

  // Singleton pattern
  public static getInstance(): KafkaService {
    if (!KafkaService.instance) {
      KafkaService.instance = new KafkaService();
    }
    return KafkaService.instance;
  }

  /**
   * Menginisialisasi dan menghubungkan producer
   */
  public async connectProducer(): Promise<void> {
    try {
      if (!this.isProducerConnected) {
        console.log('🚀 Connecting to Kafka Producer...');
        await this.producer.connect();
        this.isProducerConnected = true;
        console.log('✅ Kafka Producer connected successfully');
      }
    } catch (error) {
      console.error('❌ Failed to connect Kafka Producer:', error);
      throw new Error(`Kafka Producer connection failed: ${error}`);
    }
  }

  /**
   * Menginisialisasi dan menghubungkan admin client
   */
  private async connectAdmin(): Promise<void> {
    try {
      if (!this.isAdminConnected) {
        console.log('🔧 Connecting to Kafka Admin...');
        await this.admin.connect();
        this.isAdminConnected = true;
        console.log('✅ Kafka Admin connected successfully');
      }
    } catch (error) {
      console.error('❌ Failed to connect Kafka Admin:', error);
      throw new Error(`Kafka Admin connection failed: ${error}`);
    }
  }

  /**
   * Membuat topics yang diperlukan jika belum ada
   */
  public async createTopics(): Promise<void> {
    try {
      await this.connectAdmin();

      console.log('📝 Creating Kafka topics...');
      
      // Cek topics yang sudah ada
      const existingTopics = await this.admin.listTopics();
      const topicsToCreate = [];

      // Cek dan tambahkan vc_requests jika belum ada
      if (!existingTopics.includes(KAFKA_TOPICS.VC_REQUESTS)) {
        topicsToCreate.push({
          topic: KAFKA_TOPICS.VC_REQUESTS,
          numPartitions: TOPIC_CONFIG.numPartitions,
          replicationFactor: TOPIC_CONFIG.replicationFactor,
        });
      }

      // Cek dan tambahkan vc_issuances jika belum ada
      if (!existingTopics.includes(KAFKA_TOPICS.VC_ISSUANCES)) {
        topicsToCreate.push({
          topic: KAFKA_TOPICS.VC_ISSUANCES,
          numPartitions: TOPIC_CONFIG.numPartitions,
          replicationFactor: TOPIC_CONFIG.replicationFactor,
        });
      }

      if (topicsToCreate.length > 0) {
        await this.admin.createTopics({
          topics: topicsToCreate,
          waitForLeaders: true,
          timeout: 5000,
        });
        
        console.log(`✅ Created topics: ${topicsToCreate.map(t => t.topic).join(', ')}`);
      } else {
        console.log('ℹ️ All required topics already exist');
      }

    } catch (error) {
      console.error('❌ Failed to create topics:', error);
      throw new Error(`Topic creation failed: ${error}`);
    }
  }

  /**
   * Mengirim pesan ke Kafka topic
   * @param topic - Nama topic
   * @param key - Key untuk partitioning
   * @param message - Pesan yang akan dikirim
   */
  public async sendMessage(topic: string, key: string, message: any): Promise<void> {
    try {
      if (!this.isProducerConnected) {
        await this.connectProducer();
      }

      const kafkaMessage = {
        key: key,
        value: JSON.stringify(message),
        timestamp: Date.now().toString(),
        headers: {
          'content-type': 'application/json',
          'source': 'ganesha-dcert-api'
        }
      };

      const result = await this.producer.send({
        topic: topic,
        messages: [kafkaMessage],
      });

      console.log(`📤 Message sent to topic '${topic}':`, {
        partition: result[0].partition,
        offset: result[0].offset,
        key: key
      });

    } catch (error) {
      console.error(`❌ Failed to send message to topic '${topic}':`, error);
      throw new Error(`Message sending failed: ${error}`);
    }
  }

  /**
   * Graceful shutdown
   */
  public async disconnect(): Promise<void> {
    try {
      console.log('🔌 Disconnecting Kafka connections...');
      
      if (this.isProducerConnected) {
        await this.producer.disconnect();
        this.isProducerConnected = false;
      }
      
      if (this.isAdminConnected) {
        await this.admin.disconnect();
        this.isAdminConnected = false;
      }
      
      console.log('✅ Kafka connections closed successfully');
    } catch (error) {
      console.error('❌ Error during Kafka disconnect:', error);
    }
  }

  /**
   * Consume messages dari topic berdasarkan key (DID)
   * Digunakan untuk query partition-specific data
   */
  public async consumeMessagesByKey(
    topic: string, 
    key: string, 
    timeoutMs: number = 10000
  ): Promise<any[]> {
    const consumer = KafkaClient.consumer({ 
      groupId: `query-${key}-${Date.now()}`, // Unique consumer group per query
      sessionTimeout: 30000,
      heartbeatInterval: 3000
    });

    const messages: any[] = [];
    let startTime = Date.now();

    try {
      console.log(`🔍 Starting consumption for key: ${key} from topic: ${topic}`);
      
      await consumer.connect();
      await consumer.subscribe({ topic, fromBeginning: true });

      return new Promise((resolve, reject) => {
        const timeoutHandle = setTimeout(async () => {
          console.log(`⏱️ Timeout reached, found ${messages.length} messages for key: ${key}`);
          await consumer.disconnect();
          resolve(messages);
        }, timeoutMs);

        consumer.run({
          eachMessage: async ({ message }) => {
            try {
              const messageKey = message.key?.toString();
              const messageValue = message.value?.toString();

              // Filter messages by key
              if (messageKey === key && messageValue) {
                const parsedMessage = JSON.parse(messageValue);
                messages.push(parsedMessage);
                
                console.log(`✅ Found message for key ${key}:`, {
                  offset: message.offset,
                  timestamp: message.timestamp
                });
              }

              // Check if we should stop early (optional optimization)
              const elapsed = Date.now() - startTime;
              if (elapsed >= timeoutMs) {
                clearTimeout(timeoutHandle);
                await consumer.disconnect();
                resolve(messages);
              }
            } catch (parseError) {
              console.error('Error parsing message:', parseError);
            }
          }
        }).catch(error => {
          clearTimeout(timeoutHandle);
          consumer.disconnect();
          reject(error);
        });
      });

    } catch (error) {
      console.error(`❌ Error consuming messages for key ${key}:`, error);
      await consumer.disconnect();
      throw error;
    }
  }

  // Getter untuk status koneksi
  public get isConnected(): boolean {
    return this.isProducerConnected;
  }
}

// Export singleton instance
export const kafkaService = KafkaService.getInstance();
export default kafkaService;
