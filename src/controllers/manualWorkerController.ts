import { Request, Response } from 'express';
import { getChannel } from '../config/rabbitmq';
import { Message } from 'amqplib';

const ISSUANCE_QUEUE = 'issuance_requests';

// Variabel sementara untuk menyimpan pesan yang diambil
// Ini hanya untuk mencegah pesan diambil berulang kali sebelum di-ack
let fetchedMessage: Message | null = null;
const exchangeName = 'vc_requests_exchange';

export const fetchNextRequest = async (req: Request, res: Response) => {
  const { issuer_did } = req.query;

  if (!issuer_did) {
    return res.status(400).json({ error: 'Missing required query parameter: issuer_did.' });
  }

  // Generate a queue name and routing key based on the issuer's DID
  const queueName = `issuer-queue-${issuer_did.toString().replace(/:/g, '_')}`;
  const routingKey = `request.${issuer_did.toString().replace(/:/g, '.')}`;

  try {
    const channel = await getChannel();
    // Ensure the exchange exists
    await channel.assertExchange(exchangeName, 'topic', { durable: true });
    // Assert the issuer's specific queue
    await channel.assertQueue(queueName, { durable: true });
    // Bind the queue to the exchange with the specific routing key
    await channel.bindQueue(queueName, exchangeName, routingKey);

    const message = await channel.get(queueName, { noAck: false });

    if (!message) {
      return res.status(404).json({ message: `No new requests found for issuer ${issuer_did}.` });
    }
    
    // Store the message for later acknowledgment
    fetchedMessage = message;
    res.status(200).json({
      message: 'Request fetched successfully.',
      jobDetails: JSON.parse(message.content.toString()),
    });
  } catch (error) {
    console.error("An error occurred during message fetching:", error);
    res.status(500).json({ error: 'Failed to fetch the next request.' });
  }
};

export const issueCredential = async (req: Request, res: Response) => {
  const { jobDetails, signedVc } = req.body;

  if (!jobDetails || !signedVc) {
    return res.status(400).json({ error: 'Request body must include jobDetails and signedVc.' });
  }
  if (!fetchedMessage || JSON.parse(fetchedMessage.content.toString()).correlationId !== jobDetails.correlationId) {
      return res.status(400).json({ error: 'The provided jobDetails do not match the fetched request. Please fetch the request again.' });
  }

  const channel = await getChannel();
  
  const replyMessage = {
    vc: signedVc,
    correlation_id: jobDetails.correlationId,
  };
  
  try {
    channel.sendToQueue(jobDetails.replyTo, Buffer.from(JSON.stringify(replyMessage)));
    channel.ack(fetchedMessage); // Hapus pesan dari antrian
    fetchedMessage = null; // Reset variabel
    res.status(200).json({ message: `Successfully sent VC to ${jobDetails.payload.holder_did}` });
  } catch (error) {
    console.error("An error occurred during VC issuance:", error);
    res.status(500).json({ error: 'Failed to issue the VC.' });
  }
};