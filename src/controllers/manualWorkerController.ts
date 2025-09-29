import { Request, Response } from 'express';
import { getChannel } from '../config/rabbitmq';
import { Message } from 'amqplib';

const ISSUANCE_QUEUE = 'issuance_requests';

// Variabel sementara untuk menyimpan pesan yang diambil
// Ini hanya untuk mencegah pesan diambil berulang kali sebelum di-ack
let fetchedMessage: Message | null = null;

export const fetchNextRequest = async (req: Request, res: Response) => {
  if (fetchedMessage) {
    return res.status(400).json({ 
        message: 'There is already a fetched request waiting to be processed.',
        jobDetails: JSON.parse(fetchedMessage.content.toString())
    });
  }
  const channel = await getChannel();
  const message = await channel.get(ISSUANCE_QUEUE, { noAck: false });
  if (!message) {
    return res.status(404).json({ message: 'No new requests in the queue.' });
  }
  fetchedMessage = message;
  res.status(200).json({
    message: 'Request fetched successfully.',
    jobDetails: JSON.parse(message.content.toString()),
  });
};

export const issueCredential = async (req: Request, res: Response) => {
  const { jobDetails, signedVcJwt } = req.body;

  if (!jobDetails || !signedVcJwt) {
    return res.status(400).json({ error: 'Request body must include jobDetails and signedVcJwt.' });
  }
  if (!fetchedMessage || JSON.parse(fetchedMessage.content.toString()).correlationId !== jobDetails.correlationId) {
      return res.status(400).json({ error: 'The provided jobDetails do not match the fetched request. Please fetch the request again.' });
  }

  const channel = await getChannel();
  
  const replyMessage = {
    vc: signedVcJwt,
    correlation_id: jobDetails.correlationId,
  };
  
  channel.sendToQueue(jobDetails.replyTo, Buffer.from(JSON.stringify(replyMessage)));
  channel.ack(fetchedMessage); // Hapus pesan dari antrian
  fetchedMessage = null; // Reset variabel

  res.status(200).json({ message: `Successfully sent VC to ${jobDetails.payload.holder_did}` });
};