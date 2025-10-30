/**
 * JWT Debug & Alternative Verification Methods
 * 
 * This file contains debugging utilities and alternative verification approaches
 * to handle different ES256 signature formats
 */

import { webcrypto } from 'crypto';
import * as crypto from 'crypto';

/**
 * Decode base64url
 */
function base64UrlDecode(base64url: string): Uint8Array {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  return new Uint8Array(Buffer.from(base64 + padding, 'base64'));
}

/**
 * Alternative ES256 verification using Node.js crypto directly (not webcrypto)
 * This uses the raw crypto module which might handle signatures differently
 */
export async function verifyJWTWithNodeCrypto(
  jwt: string,
  publicKeyBytes: Uint8Array
): Promise<boolean> {
  const parts = jwt.split('.');
  if (parts.length !== 3) return false;

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  
  try {
    // Get signing input
    const signingInput = `${encodedHeader}.${encodedPayload}`;
    
    // Decode signature (already in IEEE P1363 format from JWT)
    const signature = base64UrlDecode(encodedSignature);
    
    console.log('\n=== Node.js Crypto Verification ===');
    console.log('Signature length:', signature.length);
    console.log('Signature (hex):', Buffer.from(signature).toString('hex'));
    
    // Create public key from raw bytes
    const publicKeyPem = createPemFromRawPublicKey(publicKeyBytes);
    console.log('Public Key PEM:\n', publicKeyPem);
    
    // Create verifier
    const verifier = crypto.createVerify('SHA256');
    verifier.update(signingInput);
    
    // Try to verify with DER signature
    const derSignature = ieee1363ToDer(signature);
    const isValid = verifier.verify(
      {
        key: publicKeyPem,
        format: 'pem',
        type: 'spki'
      },
      derSignature
    );
    
    console.log('Verification result (Node.js crypto):', isValid);
    return isValid;
    
  } catch (error) {
    console.error('Node.js crypto verification error:', error);
    return false;
  }
}

/**
 * Create PEM from raw public key bytes
 */
function createPemFromRawPublicKey(publicKeyBytes: Uint8Array): string {
  // SPKI header for P-256 public key
  const spkiHeader = Buffer.from([
    0x30, 0x59, // SEQUENCE
    0x30, 0x13, // SEQUENCE
    0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01, // OID: ecPublicKey
    0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07, // OID: P-256
    0x03, 0x42, 0x00 // BIT STRING
  ]);
  
  const spkiKey = Buffer.concat([spkiHeader, Buffer.from(publicKeyBytes)]);
  const base64 = spkiKey.toString('base64');
  
  // Format as PEM
  const pem = `-----BEGIN PUBLIC KEY-----\n${base64.match(/.{1,64}/g)?.join('\n')}\n-----END PUBLIC KEY-----`;
  return pem;
}

/**
 * IEEE P1363 to DER conversion
 */
function ieee1363ToDer(ieee: Uint8Array): Buffer {
  if (ieee.length !== 64) {
    throw new Error('IEEE P1363 signature must be 64 bytes for ES256');
  }

  const r = ieee.slice(0, 32);
  const s = ieee.slice(32, 64);

  function encodeInteger(value: Uint8Array): Buffer {
    let bytes = Buffer.from(value);
    
    // Remove leading zeros
    while (bytes.length > 1 && bytes[0] === 0x00 && bytes[1] < 0x80) {
      bytes = bytes.slice(1);
    }
    
    // Add leading zero if first byte >= 0x80
    if (bytes[0] >= 0x80) {
      bytes = Buffer.concat([Buffer.from([0x00]), bytes]);
    }
    
    return Buffer.concat([
      Buffer.from([0x02]), // INTEGER tag
      Buffer.from([bytes.length]), // length
      bytes
    ]);
  }

  const rDer = encodeInteger(r);
  const sDer = encodeInteger(s);
  
  const derContent = Buffer.concat([rDer, sDer]);
  
  return Buffer.concat([
    Buffer.from([0x30]), // SEQUENCE tag
    Buffer.from([derContent.length]), // length
    derContent
  ]);
}

/**
 * Debug: Print all JWT components
 */
export function debugJWT(jwt: string, publicKeyHex: string): void {
  console.log('\n=== JWT DEBUG INFO ===');
  
  const parts = jwt.split('.');
  console.log('JWT Parts:', parts.length);
  
  if (parts.length !== 3) {
    console.log('❌ Invalid JWT format');
    return;
  }
  
  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  
  // Decode header
  const headerBytes = base64UrlDecode(encodedHeader);
  const header = JSON.parse(Buffer.from(headerBytes).toString('utf-8'));
  console.log('Header:', JSON.stringify(header, null, 2));
  
  // Decode payload
  const payloadBytes = base64UrlDecode(encodedPayload);
  const payload = JSON.parse(Buffer.from(payloadBytes).toString('utf-8'));
  console.log('Payload:', JSON.stringify(payload, null, 2));
  
  // Signature info
  const signature = base64UrlDecode(encodedSignature);
  console.log('\nSignature Info:');
  console.log('- Length:', signature.length, 'bytes');
  console.log('- Hex:', Buffer.from(signature).toString('hex'));
  console.log('- Base64url:', encodedSignature);
  
  // Signing input
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  console.log('\nSigning Input:');
  console.log('- String:', signingInput);
  console.log('- Length:', signingInput.length, 'chars');
  console.log('- SHA256 hash:', crypto.createHash('sha256').update(signingInput).digest('hex'));
  
  // Public key info
  console.log('\nPublic Key Info:');
  const publicKeyBytes = Buffer.from(publicKeyHex, 'hex');
  console.log('- Length:', publicKeyBytes.length, 'bytes');
  console.log('- First byte:', '0x' + publicKeyBytes[0].toString(16).padStart(2, '0'));
  console.log('- Format:', publicKeyBytes[0] === 0x04 ? 'Uncompressed' : publicKeyBytes[0] === 0x02 || publicKeyBytes[0] === 0x03 ? 'Compressed' : 'Unknown');
  
  // Try DER conversion
  try {
    const derSig = ieee1363ToDer(signature);
    console.log('\nDER Signature:');
    console.log('- Length:', derSig.length, 'bytes');
    console.log('- Hex:', derSig.toString('hex'));
  } catch (error) {
    console.log('❌ Failed to convert to DER:', error);
  }
  
  console.log('\n=== END DEBUG ===\n');
}

/**
 * Try multiple verification methods
 */
export async function tryAllVerificationMethods(
  jwt: string,
  publicKeyHex: string
): Promise<{ method: string; result: boolean }[]> {
  const publicKeyBytes = Buffer.from(publicKeyHex, 'hex');
  const results: { method: string; result: boolean }[] = [];
  
  console.log('\n=== TRYING ALL VERIFICATION METHODS ===\n');
  
  // Method 1: Node.js crypto with DER
  try {
    const result = await verifyJWTWithNodeCrypto(jwt, publicKeyBytes);
    results.push({ method: 'Node.js crypto (DER)', result });
  } catch (error) {
    console.error('Method 1 error:', error);
    results.push({ method: 'Node.js crypto (DER)', result: false });
  }
  
  // Method 2: Try with raw IEEE P1363 signature using Node.js crypto
  try {
    const parts = jwt.split('.');
    const signingInput = `${parts[0]}.${parts[1]}`;
    const signature = base64UrlDecode(parts[2]);
    
    const publicKeyPem = createPemFromRawPublicKey(publicKeyBytes);
    const verifier = crypto.createVerify('SHA256');
    verifier.update(signingInput);
    
    // Try verifying with raw signature (might work for some implementations)
    const result = verifier.verify(
      { key: publicKeyPem, format: 'pem', type: 'spki' },
      signature
    );
    results.push({ method: 'Node.js crypto (raw IEEE P1363)', result });
  } catch (error) {
    console.error('Method 2 error:', error);
    results.push({ method: 'Node.js crypto (raw IEEE P1363)', result: false });
  }
  
  console.log('\n=== VERIFICATION RESULTS ===');
  results.forEach(r => {
    console.log(`${r.result ? '✅' : '❌'} ${r.method}: ${r.result}`);
  });
  console.log('\n');
  
  return results;
}