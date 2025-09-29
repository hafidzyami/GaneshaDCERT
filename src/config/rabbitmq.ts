import amqp from 'amqplib';
import 'dotenv/config';

let channel: amqp.Channel | null = null;
export const getChannel = async (): Promise<amqp.Channel> => {
  if (channel) return channel;
  const amqpUrl = process.env.RABBITMQ_URL || 'amqp://user:password@localhost:5672';
  const connection = await amqp.connect(amqpUrl);
  channel = await connection.createChannel();
  console.log('✅ RabbitMQ connection established.');
  return channel;
};