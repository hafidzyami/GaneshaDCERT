// src/controllers/issuanceController.ts
import { Request, Response } from 'express';
import { getChannel } from '../config/rabbitmq';
import { v4 as uuidv4 } from 'uuid';

/**
 * Menerima permintaan VC dari holder dan mempublikasikannya ke exchange pusat
 * untuk dirutekan ke issuer yang benar.
 */
export const requestVcIssuance = async (req: Request, res: Response) => {
  // 1. Ambil semua data yang dibutuhkan dari body request
  const { payload, signature, issuer_did } = req.body;

  // 2. Validasi input
  if (!payload || !signature || !payload.holder_did || !issuer_did) {
    return res.status(400).json({ 
      error: 'Missing required fields: payload, signature, and issuer_did are required.' 
    });
  }
  
  try {
    const channel = await getChannel();
    const exchangeName = 'vc_requests_exchange';

    // Pastikan exchange-nya ada (tipe 'topic' untuk perutean fleksibel)
    await channel.assertExchange(exchangeName, 'topic', { durable: true });

    const correlationId = uuidv4();
    const replyTo = `replies-for-${payload.holder_did.replace(/:/g, '_')}`;
    
    // Siapkan pesan lengkap untuk dikirim ke worker
    const messageToQueue = { payload, signature, correlationId, replyTo };

    // 3. Buat routing key dari issuer_did yang dipilih oleh klien
    const routingKey = `request.${issuer_did.replace(/:/g, '.')}`;
    
    // 4. Publikasikan pesan ke exchange dengan routing key yang benar
    channel.publish(
      exchangeName, 
      routingKey, 
      Buffer.from(JSON.stringify(messageToQueue)), 
      { persistent: true }
    );

    console.log(`[API] 🚀 Request ${correlationId} sent to exchange with routing key "${routingKey}"`);

    // 5. Beri respons cepat ke klien
    res.status(202).json({
      status: 'pending',
      correlation_id: correlationId,
    });

  } catch (error) {
    console.error('Failed to publish message:', error);
    res.status(500).json({ error: 'Failed to process request' });
  }
};