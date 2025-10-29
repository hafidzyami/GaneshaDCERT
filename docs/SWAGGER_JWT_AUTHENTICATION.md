# How to Use JWT Authentication in Swagger UI

## Step-by-Step Guide

### 1. **Generate Your JWT Token**

First, you need to generate a JWT token signed with your private key. Use the frontend code or this script:

```typescript
import * as secp from '@noble/secp256k1';

const privateKeyHex = 'your-private-key-here';
const privateKey = secp.etc.hexToBytes(privateKeyHex);
const did = 'did:dcert:iAk3ViiU5foEU32H7YXg4fGZRCxHVOg7TnwwBdWyR1k3b';

// Create header and payload
const header = { alg: 'ES256', typ: 'JWT' };
const payload = {
  role: 'institution',
  iat: Math.floor(Date.now() / 1000),
  iss: did,
  sub: did,
  exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60)
};

// Encode to base64url
const base64urlEncode = (obj) => {
  return Buffer.from(JSON.stringify(obj))
    .toString('base64')
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
};

const encodedHeader = base64urlEncode(header);
const encodedPayload = base64urlEncode(payload);

// Sign ONLY the DID
const didBytes = new TextEncoder().encode(did);
const signature = await secp.signAsync(didBytes, privateKey);

// Convert signature to base64url
const signatureBase64url = Buffer.from(signature)
  .toString('base64')
  .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

// Final JWT
const jwt = `${encodedHeader}.${encodedPayload}.${signatureBase64url}`;
console.log('JWT Token:', jwt);
```

Example JWT token:
```
eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiaW5zdGl0dXRpb24iLCJpYXQiOjE3NjE3MDQxODAsImlzcyI6ImRpZDpkY2VydDppQWszVmlpVTVmb0VVMzJIN1lYZzRmR1pSQ3hIVk9nN1Rud3dCZFd5UjFrM2IiLCJzdWIiOiJkaWQ6ZGNlcnQ6aUFrM1ZpaVU1Zm9FVTMySDdZWGc0ZkdaUkN4SFZPZzdUbnd3QmRXeVIxazNiIiwiZXhwIjoxNzYyMzA4OTgwfQ.BhE7POwzdVYUFPa40acI4pxoL72qz63RckcFrV70oBXi4VrAE3DBvtA6X8s7Gc1q97hJ8fPqXhFqHRUV5sv4Ww
```

### 2. **Open Swagger UI**

Navigate to: `http://localhost:3069/api-docs`

### 3. **Authorize in Swagger**

1. Look for the **"Authorize"** button (usually at the top right with a lock icon 🔒)
2. Click the **"Authorize"** button
3. You'll see a modal with different security schemes

### 4. **Enter Your JWT Token**

1. Find **"HolderBearerAuth"** section
2. In the **Value** field, enter your JWT token:
   ```
   eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiaW5zdGl0dXRpb24iLCJpYXQiOjE3NjE3MDQxODAsImlzcyI6ImRpZDpkY2VydDppQWszVmlpVTVmb0VVMzJIN1lYZzRmR1pSQ3hIVk9nN1Rud3dCZFd5UjFrM2IiLCJzdWIiOiJkaWQ6ZGNlcnQ6aUFrM1ZpaVU1Zm9FVTMySDdZWGc0ZkdaUkN4SFZPZzdUbnd3QmRXeVIxazNiIiwiZXhwIjoxNzYyMzA4OTgwfQ.BhE7POwzdVYUFPa40acI4pxoL72qz63RckcFrV70oBXi4VrAE3DBvtA6X8s7Gc1q97hJ8fPqXhFqHRUV5sv4Ww
   ```
   
   **⚠️ IMPORTANT:** 
   - **DO NOT** include "Bearer " prefix - Swagger adds it automatically
   - Just paste the JWT token directly

3. Click **"Authorize"** button
4. Click **"Close"**

### 5. **Test Protected Endpoints**

Now you can test protected endpoints like:

- `POST /api/v1/credentials/requests`
- `POST /api/v1/credentials/update-request`
- `POST /api/v1/credentials/renew-requests`
- `POST /api/v1/credentials/revoke-request`

The Authorization header will be automatically added to all requests!

### 6. **Verify Authorization**

After clicking "Try it out" and "Execute" on any protected endpoint, check the **curl** command in the response. You should see:

```bash
curl -X 'POST' \
  'http://localhost:3069/api/v1/credentials/requests' \
  -H 'accept: application/json' \
  -H 'Authorization: Bearer eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9...' \
  -H 'Content-Type: application/json' \
  -d '{...}'
```

Notice the `Authorization: Bearer ...` header is now included! ✅

## Troubleshooting

### ❌ Still Getting 401 Unauthorized?

**Problem:** Token not being sent

**Check:**
1. Did you click "Authorize" button?
2. Did you paste the token in the correct field (HolderBearerAuth)?
3. Did you click "Authorize" then "Close" in the modal?
4. Check if the lock icon shows as "locked" 🔒

**Solution:**
- Refresh the page and try again
- Make sure you're using the correct security scheme (HolderBearerAuth)
- Verify your JWT token is valid (3 parts separated by dots)

### ❌ Token Expired Error?

**Problem:** JWT token `exp` claim is in the past

**Solution:**
- Generate a new JWT token with future expiration
- Use `exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60)` for 7 days

### ❌ Invalid Signature Error?

**Problem:** Signature doesn't match the DID

**Possible causes:**
1. Frontend signed wrong data (should sign DID only)
2. Wrong private key used
3. Public key in blockchain doesn't match private key

**Solution:**
- Ensure frontend signs ONLY the DID value from `iss` claim
- Verify private/public key pair match
- Check DID document on blockchain has correct public key

## Testing with cURL

If you prefer testing with cURL directly:

```bash
# Your JWT token
JWT_TOKEN="eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiaW5zdGl0dXRpb24iLCJpYXQiOjE3NjE3MDQxODAsImlzcyI6ImRpZDpkY2VydDppQWszVmlpVTVmb0VVMzJIN1lYZzRmR1pSQ3hIVk9nN1Rud3dCZFd5UjFrM2IiLCJzdWIiOiJkaWQ6ZGNlcnQ6aUFrM1ZpaVU1Zm9FVTMySDdZWGc0ZkdaUkN4SFZPZzdUbnd3QmRXeVIxazNiIiwiZXhwIjoxNzYyMzA4OTgwfQ.BhE7POwzdVYUFPa40acI4pxoL72qz63RckcFrV70oBXi4VrAE3DBvtA6X8s7Gc1q97hJ8fPqXhFqHRUV5sv4Ww"

# Test endpoint
curl -X POST http://localhost:3069/api/v1/credentials/requests \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -d '{
    "holder_did": "did:dcert:iAk3ViiU5foEU32H7YXg4fGZRCxHVOg7TnwwBdWyR1k3b",
    "issuer_did": "did:dcert:i0987654321...",
    "encrypted_body": "encrypted_data"
  }'
```

## Visual Guide

```
┌─────────────────────────────────────────┐
│         Swagger UI Interface            │
├─────────────────────────────────────────┤
│                                         │
│  🔒 Authorize ← Click this button      │
│                                         │
└─────────────────────────────────────────┘

         ↓ Opens Modal

┌─────────────────────────────────────────┐
│      Available authorizations           │
├─────────────────────────────────────────┤
│                                         │
│  HolderBearerAuth (http, Bearer)       │
│  ┌───────────────────────────────────┐ │
│  │ Value:                            │ │
│  │ [Paste your JWT token here]      │ │
│  └───────────────────────────────────┘ │
│                                         │
│        [Authorize]  [Close]            │
│                                         │
└─────────────────────────────────────────┘

         ↓ Click Authorize then Close

┌─────────────────────────────────────────┐
│         Swagger UI Interface            │
├─────────────────────────────────────────┤
│                                         │
│  🔓 Authorize ← Now shows unlocked     │
│                                         │
│  All protected endpoints now have      │
│  the JWT token automatically added!    │
│                                         │
└─────────────────────────────────────────┘
```

## Security Notes

⚠️ **Never share your JWT tokens or private keys!**
- JWT tokens give access to make requests as the holder
- Private keys can be used to create unlimited valid tokens
- Always use HTTPS in production
- Set reasonable expiration times on tokens
