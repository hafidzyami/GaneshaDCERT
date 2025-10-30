/**
 * JWT Test Script
 * 
 * This script will:
 * 1. Generate a test ES256 keypair
 * 2. Sign a JWT with the private key
 * 3. Verify the JWT with the public key
 * 4. Test with your actual public key from blockchain
 */

import { webcrypto } from 'crypto';
import { signJWT, verifyJWT, decodeJWT } from './src/config/jwt-es256';
import * as crypto from 'crypto';

/**
 * Generate ES256 keypair for testing
 */
async function generateTestKeypair() {
  const keypair = await webcrypto.subtle.generateKey(
    {
      name: 'ECDSA',
      namedCurve: 'P-256',
    },
    true, // extractable
    ['sign', 'verify']
  );

  return keypair;
}

/**
 * Export public key to hex (uncompressed format)
 */
async function exportPublicKeyToHex(publicKey: webcrypto.CryptoKey): Promise<string> {
  const exported = await webcrypto.subtle.exportKey('spki', publicKey);
  const buffer = Buffer.from(exported);
  
  // Extract the raw public key bytes (last 65 bytes of SPKI)
  const rawPublicKey = buffer.slice(-65);
  
  return rawPublicKey.toString('hex');
}

/**
 * Test 1: Generate keypair, sign, and verify JWT
 */
async function testBasicJWT() {
  console.log('\n=== TEST 1: Basic JWT Sign & Verify ===\n');
  
  try {
    // Generate keypair
    const keypair = await generateTestKeypair();
    console.log('✅ Generated ES256 keypair');
    
    // Export public key
    const publicKeyHex = await exportPublicKeyToHex(keypair.publicKey);
    console.log('Public key (hex):', publicKeyHex);
    console.log('Public key length:', publicKeyHex.length, 'chars (', publicKeyHex.length / 2, 'bytes)');
    
    // Create JWT
    const payload = {
      purpose: 'test',
      iat: Math.floor(Date.now() / 1000),
      iss: 'did:dcert:test123',
      sub: 'did:dcert:test123',
      exp: Math.floor(Date.now() / 1000) + 3600,
    };
    
    const jwt = await signJWT(payload, keypair.privateKey);
    console.log('\n✅ JWT created:', jwt);
    
    // Decode JWT
    const decoded = decodeJWT(jwt);
    console.log('\nDecoded JWT:');
    console.log('Header:', decoded.header);
    console.log('Payload:', decoded.payload);
    
    // Verify with CryptoKey
    const isValid1 = await verifyJWT(jwt, keypair.publicKey);
    console.log('\n✅ Verification with CryptoKey:', isValid1 ? 'SUCCESS' : 'FAILED');
    
    // Verify with raw bytes
    const publicKeyBytes = Buffer.from(publicKeyHex, 'hex');
    const isValid2 = await verifyJWT(jwt, publicKeyBytes);
    console.log('✅ Verification with raw bytes:', isValid2 ? 'SUCCESS' : 'FAILED');
    
    if (isValid1 && isValid2) {
      console.log('\n🎉 Test 1 PASSED: JWT signing and verification work correctly!\n');
      return true;
    } else {
      console.log('\n❌ Test 1 FAILED: JWT verification failed\n');
      return false;
    }
  } catch (error) {
    console.error('❌ Test 1 ERROR:', error);
    return false;
  }
}

/**
 * Test 2: Verify the actual JWT from your client
 */
async function testActualJWT(jwt: string, publicKeyHex: string) {
  console.log('\n=== TEST 2: Verify Actual JWT from Client ===\n');
  
  try {
    console.log('JWT:', jwt);
    console.log('\nPublic Key (hex):', publicKeyHex);
    
    // Decode JWT
    const decoded = decodeJWT(jwt);
    console.log('\nDecoded JWT:');
    console.log('Header:', JSON.stringify(decoded.header, null, 2));
    console.log('Payload:', JSON.stringify(decoded.payload, null, 2));
    console.log('Signature:', decoded.signature);
    
    // Convert public key to bytes
    const publicKeyBytes = Buffer.from(publicKeyHex, 'hex');
    
    // Verify
    const isValid = await verifyJWT(jwt, publicKeyBytes);
    console.log('\nVerification result:', isValid ? '✅ SUCCESS' : '❌ FAILED');
    
    if (isValid) {
      console.log('\n🎉 Test 2 PASSED: Actual JWT is valid!\n');
      return true;
    } else {
      console.log('\n❌ Test 2 FAILED: Actual JWT verification failed\n');
      console.log('Possible causes:');
      console.log('1. JWT was signed with a different private key');
      console.log('2. JWT was corrupted during transmission');
      console.log('3. Public key does not match the private key used for signing');
      return false;
    }
  } catch (error) {
    console.error('❌ Test 2 ERROR:', error);
    return false;
  }
}

/**
 * Test 3: Try to extract private key information from JWT signature
 * (This won't work but helps understand the signature)
 */
async function analyzeSignature(jwt: string) {
  console.log('\n=== TEST 3: Signature Analysis ===\n');
  
  const parts = jwt.split('.');
  const signatureBase64 = parts[2];
  const signatureBytes = Buffer.from(signatureBase64.replace(/-/g, '+').replace(/_/g, '/') + '=='.slice(0, (4 - signatureBase64.length % 4) % 4), 'base64');
  
  console.log('Signature (base64url):', signatureBase64);
  console.log('Signature (hex):', signatureBytes.toString('hex'));
  console.log('Signature length:', signatureBytes.length, 'bytes');
  
  if (signatureBytes.length === 64) {
    const r = signatureBytes.slice(0, 32);
    const s = signatureBytes.slice(32, 64);
    
    console.log('\nES256 signature components:');
    console.log('r (32 bytes):', r.toString('hex'));
    console.log('s (32 bytes):', s.toString('hex'));
  }
  
  console.log('\n');
}

/**
 * Run all tests
 */
async function runTests() {
  console.log('╔═══════════════════════════════════════════╗');
  console.log('║  JWT ES256 Test Suite                    ║');
  console.log('╚═══════════════════════════════════════════╝');
  
  // Test 1: Basic functionality
  const test1Result = await testBasicJWT();
  
  // Test 2: Actual JWT (you need to provide this)
  const actualJWT = 'eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.eyJwdXJwb3NlIjoiYXBpX2F1dGhlbnRpY2F0aW9uIiwiaWF0IjoxNzYxNzI0MzgxLCJpc3MiOiJkaWQ6ZGNlcnQ6dUJMUFpnanAweHhFZ3lPeWxwMmo5OTJ4cVlNcXk1OVdXYnpCR3kxZG80QmNkc200VFdkbGhLUDBvcWlieDJVUHc4Q3R5d1RPUjdMSTJjZ3JjZ2lZV0gyQSIsInN1YiI6ImRpZDpkY2VydDp1QkxQWmdqcDB4eEVneU95bHAyajk5MnhxWU1xeTU5V1diekJHeTFkbzRCY2RzbTRUV2RsaEtQMG9xaWJ4MlVQdzhDdHl3VE9SN0xJMmNncmNnaVlXSDJBIiwiZXhwIjoxNzYyMzI5MTgxfQ.zgodrh8Wz794KkARdk0_LBVdkndV347g5RAQ0iBBlowY7kVb6HVw8kkqJSKkQpiF0vqo1ZqHAGHCuYStwj-t_A';
  const actualPublicKey = '0480ade21b54a3af255148ee76db38056303e5e916f9ba6fb39e9c8e604d5b48e2b9a5fdda91fd0ebe077f193f98040b1013fcb074f3485182512c91b2b78d11cb';
  
  await analyzeSignature(actualJWT);
  const test2Result = await testActualJWT(actualJWT, actualPublicKey);
  
  // Summary
  console.log('\n╔═══════════════════════════════════════════╗');
  console.log('║  Test Summary                             ║');
  console.log('╚═══════════════════════════════════════════╝');
  console.log(`Test 1 (Basic JWT): ${test1Result ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Test 2 (Actual JWT): ${test2Result ? '✅ PASS' : '❌ FAIL'}`);
  
  if (!test2Result) {
    console.log('\n⚠️  DIAGNOSIS:');
    console.log('The JWT from your client is NOT valid with the provided public key.');
    console.log('\nThis means one of the following:');
    console.log('1. The JWT was signed with a DIFFERENT private key than the one that corresponds to this public key');
    console.log('2. The frontend is using a different keypair than what\'s stored in the blockchain');
    console.log('3. There\'s a mismatch between the DID and the actual keys being used');
    console.log('\n💡 SOLUTION:');
    console.log('Check your frontend code:');
    console.log('- Ensure the private key used for signing matches the public key in the DID document');
    console.log('- Verify that the same keypair is being used consistently');
    console.log('- Make sure the keypair wasn\'t regenerated after being stored in the blockchain');
  }
  
  console.log('\n');
}

// Run tests
runTests().catch(console.error);