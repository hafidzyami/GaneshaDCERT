// src/worker.ts
import { getChannel } from './config/rabbitmq';
import { verifySignature } from './services/signatureService';

const ISSUANCE_QUEUE = 'issuance_requests';

const startWorker = async () => {
  try {
    const channel = await getChannel();
    await channel.assertQueue(ISSUANCE_QUEUE, { durable: true });
    
    // Fair dispatch: Only fetch one message at a time
    channel.prefetch(1); 

    console.log(`[Worker] 👷 Waiting for requests in queue: ${ISSUANCE_QUEUE}`);

    channel.consume(ISSUANCE_QUEUE, async (msg) => {
      if (msg) {
        try {
          const { payload, signature, correlationId, replyTo } = JSON.parse(
            msg.content.toString()
          );

          console.log(`[Worker] Received request with Correlation ID: ${correlationId}`);

          // 1. Verify the signature
          const isSignatureValid = verifySignature(
            payload,
            signature,
            payload.holder_did
          );

          if (!isSignatureValid) {
            console.error(`[Worker] ❌ Invalid signature for DID: ${payload.holder_did}`);
            channel.ack(msg); // Acknowledge to remove from queue
            return;
          }

          console.log('[Worker] ✅ Signature is valid.');

          // 2. Simulate manual, long-running process (e.g., 5 seconds)
          console.log('[Worker] Simulating manual verification process...');
          await new Promise(resolve => setTimeout(resolve, 5000));
          console.log('[Worker] Manual verification complete.');

          // 3. Send the reply back to the holder's personal queue
          const vcLink = `https://university.com/vc/${correlationId}`;
          const replyMessage = {
            vc_link: vcLink,
            correlation_id: correlationId,
            status: 'completed'
          };

          await channel.assertQueue(replyTo, { durable: true });
          channel.sendToQueue(replyTo, Buffer.from(JSON.stringify(replyMessage)), {
            persistent: true,
          });

          console.log(`[Worker] ✅ VC link sent to queue: ${replyTo}`);

          // 4. Acknowledge the original message
          channel.ack(msg);
        } catch (error) {
          console.error('[Worker] Error processing message:', error);
          // In production, you might want to nack(msg, false, false) to move it to a dead-letter queue
          channel.ack(msg);
        }
      }
    });
  } catch (error) {
    console.error('Worker failed to start:', error);
  }
};

startWorker();