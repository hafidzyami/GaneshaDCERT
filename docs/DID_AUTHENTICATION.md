# DID Authentication with JWT Middleware

## Overview

This middleware verifies JWT tokens signed with the holder's private key (corresponding to their DID). The public key is retrieved from the DID document on the blockchain to verify the signature.

## Installation

```bash
npm install @noble/secp256k1
```

## How It Works

### Authentication Flow:

1. **Frontend generates JWT token:**
   - Creates JWT with payload containing `iss` (issuer DID), `sub` (subject DID), `role`, `iat`, `exp`
   - Signs JWT with holder's private key using ES256 algorithm
   - Sends token in Authorization header

2. **Backend verifies token:**
   - Extracts JWT from `Authorization: Bearer <token>` header
   - Decodes JWT to get payload (including `iss` which contains the DID)
   - Fetches public key from DID document on blockchain
   - **Verifies that the signature was created by signing the DID (value of `iss`)**
   - "Opens" the signature using the public key and compares with the DID
   - Validates that `iss` matches `sub` and token is not expired

3. **Request proceeds:**
   - If valid, attaches `holderDID`, `holderRole`, `tokenPayload` to request
   - Next middleware/controller can access holder information

## JWT Token Format

### Header:
```json
{
  "alg": "ES256",
  "typ": "JWT"
}
```

### Payload:
```json
{
  "role": "institution",
  "iat": 1761704180,
  "iss": "did:dcert:iAk3ViiU5foEU32H7YXg4fGZRCxHVOg7TnwwBdWyR1k3b",
  "sub": "did:dcert:iAk3ViiU5foEU32H7YXg4fGZRCxHVOg7TnwwBdWyR1k3b",
  "exp": 1762308980
}
```

### Complete JWT Example:
```
eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiaW5zdGl0dXRpb24iLCJpYXQiOjE3NjE3MDQxODAsImlzcyI6ImRpZDpkY2VydDppQWszVmlpVTVmb0VVMzJIN1lYZzRmR1pSQ3hIVk9nN1Rud3dCZFd5UjFrM2IiLCJzdWIiOiJkaWQ6ZGNlcnQ6aUFrM1ZpaVU1Zm9FVTMySDdZWGc0ZkdaUkN4SFZPZzdUbnd3QmRXeVIxazNiIiwiZXhwIjoxNzYyMzA4OTgwfQ.BhE7POwzdVYUFPa40acI4pxoL72qz63RckcFrV70oBXi4VrAE3DBvtA6X8s7Gc1q97hJ8fPqXhFqHRUV5sv4Ww
```

**Breaking it down:**
- **Header** (base64url): `eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9`
- **Payload** (base64url): `eyJyb2xlIjoiaW5zdGl0dXRpb24iLCJpYXQiOjE3NjE3MDQxODAsImlzcyI6ImRpZDpkY2VydDppQWszVmlpVTVmb0VVMzJIN1lYZzRmR1pSQ3hIVk9nN1Rud3dCZFd5UjFrM2IiLCJzdWIiOiJkaWQ6ZGNlcnQ6aUFrM1ZpaVU1Zm9FVTMySDdZWGc0ZkdaUkN4SFZPZzdUbnd3QmRXeVIxazNiIiwiZXhwIjoxNzYyMzA4OTgwfQ`
- **Signature** (base64url): `BhE7POwzdVYUFPa40acI4pxoL72qz63RckcFrV70oBXi4VrAE3DBvtA6X8s7Gc1q97hJ8fPqXhFqHRUV5sv4Ww`

**⚠️ IMPORTANT:** The signature is created by signing **ONLY the DID** (value from `iss` claim), NOT the entire JWT message. This is a custom implementation where:
1. Signature = `sign(DID, privateKey)`
2. Verification = `verify(signature, DID, publicKey)`

## Usage in Routes

The middleware is applied to credential routes:

```typescript
import { verifyDIDSignature } from "../middlewares";

// Protected route
router.post(
  "/requests",
  verifyDIDSignature,  // JWT verification middleware
  requestCredentialValidator,
  credentialController.requestCredential
);
```

## Request Object Extension

After successful authentication:

```typescript
interface RequestWithDID extends Request {
  holderDID?: string;          // DID from 'iss' claim
  holderPublicKey?: string;    // Public key from blockchain
  holderRole?: string;         // Role from payload ('institution' or 'individual')
  tokenPayload?: any;          // Full JWT payload
}
```

## Frontend Implementation

### Generate JWT Token with Private Key:

**CORRECT IMPLEMENTATION** - Sign only the DID:

```typescript
import * as secp from '@noble/secp256k1';

// Your private key (32 bytes)
const privateKeyHex = 'your-private-key-hex-string';
const privateKey = secp.etc.hexToBytes(privateKeyHex);

// Your DID
const did = 'did:dcert:iAk3ViiU5foEU32H7YXg4fGZRCxHVOg7TnwwBdWyR1k3b';

// Create JWT header
const header = {
  alg: 'ES256',
  typ: 'JWT'
};

// Create JWT payload
const now = Math.floor(Date.now() / 1000);
const payload = {
  role: 'institution',  // or 'individual'
  iat: now,
  iss: did,  // Issuer = holder's DID
  sub: did,  // Subject = same as issuer
  exp: now + (7 * 24 * 60 * 60)  // 7 days from now
};

// Encode header and payload to base64url
const base64urlEncode = (obj: any) => {
  return Buffer.from(JSON.stringify(obj))
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
};

const encodedHeader = base64urlEncode(header);
const encodedPayload = base64urlEncode(payload);

// ⚠️ IMPORTANT: Sign ONLY the DID, not the entire JWT message!
const didBytes = new TextEncoder().encode(did);
const signature = await secp.signAsync(didBytes, privateKey);

// Convert signature to base64url
const signatureBase64url = Buffer.from(signature)
  .toString('base64')
  .replace(/=/g, '')
  .replace(/\+/g, '-')
  .replace(/\//g, '_');

// Create final JWT
const jwt = `${encodedHeader}.${encodedPayload}.${signatureBase64url}`;

console.log('JWT Token:', jwt);

// Use in API request
fetch('http://localhost:3000/api/v1/credentials/requests', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${jwt}`
  },
  body: JSON.stringify({
    holder_did: did,
    issuer_did: 'did:dcert:i0987654321...',
    encrypted_body: 'encrypted_data'
  })
});
```

### Using a JWT Library (Simpler):

```typescript
import jwt from 'jsonwebtoken';
import * as secp from '@noble/secp256k1';

const privateKeyHex = 'your-private-key-hex';
const did = 'did:dcert:iAk3ViiU5foEU32H7YXg4fGZRCxHVOg7TnwwBdWyR1k3b';

// Convert private key to PEM format for jsonwebtoken
// Note: You may need to use a library like 'jwk-to-pem' for this
const token = jwt.sign(
  {
    role: 'institution',
    iss: did,
    sub: did
  },
  privateKeyPEM,  // Your private key in PEM format
  {
    algorithm: 'ES256',
    expiresIn: '7d'
  }
);

// Use the token
headers['Authorization'] = `Bearer ${token}`;
```

## Validation Rules

The middleware validates:

1. ✅ **JWT Format**: Must be valid 3-part JWT (header.payload.signature)
2. ✅ **Header**: `alg` must be "ES256", `typ` must be "JWT"
3. ✅ **Required Claims**: `iss` and `sub` must be present
4. ✅ **DID Format**: `iss` must start with "did:dcert:"
5. ✅ **Matching Claims**: `iss` must equal `sub`
6. ✅ **Expiration**: If `exp` is present, token must not be expired
7. ✅ **DID Status**: DID must exist and be "Active" on blockchain
8. ✅ **Public Key**: Must be found in DID document
9. ✅ **Signature**: JWT signature must be valid using public key

## Error Responses

### Invalid JWT Format:
```json
{
  "success": false,
  "message": "Invalid JWT token format"
}
```

### Invalid Header:
```json
{
  "success": false,
  "message": "Invalid JWT header. Expected alg: ES256, typ: JWT"
}
```

### Missing Claims:
```json
{
  "success": false,
  "message": "JWT payload must contain 'iss' and 'sub' claims"
}
```

### Mismatched Claims:
```json
{
  "success": false,
  "message": "JWT 'iss' and 'sub' claims must match"
}
```

### Expired Token:
```json
{
  "success": false,
  "message": "JWT token has expired"
}
```

### DID Not Found:
```json
{
  "success": false,
  "message": "DID not found on blockchain",
  "did": "did:dcert:..."
}
```

### Invalid Signature:
```json
{
  "success": false,
  "message": "Invalid JWT signature. Token verification failed",
  "did": "did:dcert:..."
}
```

## Protected Endpoints

These endpoints require JWT authentication:

- `POST /api/v1/credentials/requests`
- `POST /api/v1/credentials/update-request`
- `POST /api/v1/credentials/renew-requests`
- `POST /api/v1/credentials/revoke-request`

## Testing with cURL

```bash
curl -X POST http://localhost:3000/api/v1/credentials/requests \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiaW5zdGl0dXRpb24iLCJpYXQiOjE3NjE3MDQxODAsImlzcyI6ImRpZDpkY2VydDppQWszVmlpVTVmb0VVMzJIN1lYZzRmR1pSQ3hIVk9nN1Rud3dCZFd5UjFrM2IiLCJzdWIiOiJkaWQ6ZGNlcnQ6aUFrM1ZpaVU1Zm9FVTMySDdZWGc0ZkdaUkN4SFZPZzdUbnd3QmRXeVIxazNiIiwiZXhwIjoxNzYyMzA4OTgwfQ.BhE7POwzdVYUFPa40acI4pxoL72qz63RckcFrV70oBXi4VrAE3DBvtA6X8s7Gc1q97hJ8fPqXhFqHRUV5sv4Ww" \
  -d '{
    "holder_did": "did:dcert:iAk3ViiU5foEU32H7YXg4fGZRCxHVOg7TnwwBdWyR1k3b",
    "issuer_did": "did:dcert:i0987654321...",
    "encrypted_body": "encrypted_data"
  }'
```

## Security Considerations

1. **Private Key Storage**: Never expose private keys in code or logs
2. **HTTPS Only**: Always use HTTPS in production
3. **Token Expiration**: Set reasonable expiration times (recommended: 7 days max)
4. **DID Verification**: Middleware automatically checks DID status on blockchain
5. **Signature Verification**: Uses cryptographically secure secp256k1 verification
6. **Replay Protection**: Use `iat` (issued at) and `exp` (expiration) claims

## Advantages of This Approach

✅ **Decentralized**: No central authentication server needed  
✅ **Self-Verifying**: Public key retrieved from blockchain  
✅ **Standard JWT**: Compatible with existing JWT tools  
✅ **Secure**: Uses ES256 (secp256k1) cryptographic signatures  
✅ **Stateless**: No session storage required  
✅ **DID-Native**: Directly uses DIDs for authentication
