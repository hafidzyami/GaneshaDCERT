// client.ts
import { ethers } from 'ethers';
import { v4 as uuidv4 } from 'uuid';
import amqp from 'amqplib';

const API_URL = 'http://localhost:3000/api/vc-issuance';

// --- Konfigurasi Issuer yang Dituju ---
const ITB_ISSUER_DID = 'did:ethr:0xa0Ee7A142d267C1f36714E4a8F75612F20a79720'; // Ganti dengan DID issuer ITB Anda
const UI_ISSUER_DID = 'did:ethr:0x.....'; // Ganti dengan DID issuer UI Anda

// *** PILIH ISSUER DI SINI ***
const targetIssuerDid = ITB_ISSUER_DID; 
// **************************

// --- Konfigurasi Holder ---
const holderWallet = ethers.Wallet.createRandom();
const holderDid = `did:ethr:${holderWallet.address}`;

console.log(`Simulating Holder with DID: ${holderDid}`);

const main = async () => {
  try {
    // --- 1. Siapkan koneksi RabbitMQ untuk menerima balasan ---
    const connection = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://user:password@localhost:5672');
    const channel = await connection.createChannel();
    const personalQueue = `replies-for-${holderDid.replace(/:/g, '_')}`;
    await channel.assertQueue(personalQueue, { durable: true });

    console.log(`[Client] 🎧 Listening for VC on ${personalQueue}`);
    channel.consume(personalQueue, (msg) => {
      if (msg) {
        console.log('\n--- ✅ VC RECEIVED ---');
        const received = JSON.parse(msg.content.toString());
        console.log('VC:', received.vc);
        console.log('Correlation ID:', received.correlation_id);
        console.log('---------------------\n');
        channel.ack(msg);
        connection.close();
      }
    });

    // --- 2. Siapkan payload dan signature ---
    const payload = { 
        holder_did: holderDid, 
        nama: "Ghaylan Muhammad Fatih",
        nim: "18221042",
        nonce: uuidv4() // Nonce untuk keamanan
    };
    const signature = await holderWallet.signMessage(JSON.stringify(payload));
    
    // --- 3. Kirim permintaan ke API, termasuk issuer yang dituju ---
    await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        payload, 
        signature, 
        issuer_did: targetIssuerDid // <-- Kirim DID issuer yang dipilih
      }),
    });

    console.log(`[Client] 📨 Request sent to issuer ${targetIssuerDid}. Waiting for reply...`);

  } catch (error) {
    console.error("An error occurred:", error);
  }
};

main();