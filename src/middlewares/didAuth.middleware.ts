import { Request, Response, NextFunction } from "express";
import { HTTP_STATUS } from "../constants";
import { logger } from "../config";
import DIDService from "../services/did.service";
import * as crypto from "crypto";

/**
 * Extended Request interface with DID holder data
 */
export interface RequestWithDID extends Request {
  holderDID?: string;
  holderPublicKey?: string;
  holderRole?: string;
  tokenPayload?: any;
}

/**
 * Decode JWT token (without verification)
 */
function decodeJWT(token: string): { header: any; payload: any; signature: string } {
  const parts = token.split('.');

  if (parts.length !== 3) {
    throw new Error('Invalid JWT format. Expected 3 parts separated by dots');
  }

  const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
  const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
  const signature = parts[2];

  return { header, payload, signature };
}

/**
 * Helper function to convert base64url or hex to Buffer
 * Automatically detects if the input is hex or base64url
 */
function signatureToBuffer(signature: string): Buffer {
  // Check if signature is in hex format (only contains 0-9, a-f, A-F)
  const isHex = /^[0-9a-fA-F]+$/.test(signature);

  if (isHex) {
    // Decode from hex
    logger.debug(`Detected HEX signature format`);
    return Buffer.from(signature, 'hex');
  }

  // Otherwise, treat as base64url
  logger.debug(`Detected Base64URL signature format`);

  // Convert base64url to base64
  let base64 = signature.replace(/-/g, '+').replace(/_/g, '/');

  // Add padding if needed
  const padding = base64.length % 4;
  if (padding > 0) {
    base64 += '='.repeat(4 - padding);
  }

  // Decode base64 to bytes
  return Buffer.from(base64, 'base64');
}

/**
 * Helper function to convert raw public key (hex) to PEM format for ES256
 * ES256 uses P-256 curve (prime256v1)
 */
function publicKeyHexToPEM(publicKeyHex: string): string {
  // Remove 0x prefix if present
  const cleanHex = publicKeyHex.startsWith('0x') ? publicKeyHex.substring(2) : publicKeyHex;

  // Public key should be 65 bytes (130 hex chars) for uncompressed format (04 + X + Y)
  if (cleanHex.length !== 130) {
    throw new Error(`Invalid public key length: expected 130 hex chars, got ${cleanHex.length}`);
  }

  // Verify it starts with 04 (uncompressed point indicator)
  if (!cleanHex.startsWith('04')) {
    throw new Error('Public key must be in uncompressed format (start with 04)');
  }

  // Create buffer from hex
  const publicKeyBuffer = Buffer.from(cleanHex, 'hex');

  // Create ASN.1 DER structure for EC public key (P-256)
  // This is the standard format for SPKI (SubjectPublicKeyInfo)
  const asn1Header = Buffer.from([
    0x30, 0x59, // SEQUENCE, length 89
    0x30, 0x13, // SEQUENCE, length 19
    0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01, // OID: ecPublicKey
    0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07, // OID: prime256v1 (P-256)
    0x03, 0x42, 0x00 // BIT STRING, length 66, 0 unused bits
  ]);

  const derKey = Buffer.concat([asn1Header, publicKeyBuffer]);
  const base64Key = derKey.toString('base64');

  // Format as PEM
  return `-----BEGIN PUBLIC KEY-----\n${base64Key.match(/.{1,64}/g)?.join('\n')}\n-----END PUBLIC KEY-----`;
}

/**
 * Convert raw ECDSA signature (r||s format, 64 bytes) to DER format
 * ES256 signatures from JWT are typically in raw format (32 bytes r + 32 bytes s)
 * Node.js crypto.verify expects DER format
 */
function rawSignatureToDER(signature: Buffer): Buffer {
  if (signature.length !== 64) {
    throw new Error(`Invalid raw signature length: expected 64 bytes, got ${signature.length}`);
  }

  // Split into r and s (each 32 bytes)
  let r = signature.slice(0, 32);
  let s = signature.slice(32, 64);

  // Remove leading zeros but keep at least one byte
  while (r.length > 1 && r[0] === 0 && (r[1] & 0x80) === 0) {
    r = r.slice(1);
  }
  while (s.length > 1 && s[0] === 0 && (s[1] & 0x80) === 0) {
    s = s.slice(1);
  }

  // Add 0x00 prefix if high bit is set (to keep values positive in DER)
  if ((r[0] & 0x80) !== 0) {
    r = Buffer.concat([Buffer.from([0x00]), r]);
  }
  if ((s[0] & 0x80) !== 0) {
    s = Buffer.concat([Buffer.from([0x00]), s]);
  }

  // Build DER: SEQUENCE { INTEGER r, INTEGER s }
  const totalLength = 2 + r.length + 2 + s.length;

  return Buffer.concat([
    Buffer.from([0x30, totalLength]),          // SEQUENCE tag and length
    Buffer.from([0x02, r.length]), r,          // INTEGER tag, length, value (r)
    Buffer.from([0x02, s.length]), s           // INTEGER tag, length, value (s)
  ]);
}

/**
 * Helper function to extract raw signature from DER format
 */
function derSignatureToRaw(derSignature: Buffer): Buffer {
  if (derSignature[0] !== 0x30) {
    throw new Error('Invalid DER signature: must start with SEQUENCE tag (0x30)');
  }

  let offset = 2; // Skip SEQUENCE tag and length

  // Read r
  if (derSignature[offset] !== 0x02) {
    throw new Error('Invalid DER signature: expected INTEGER tag for r');
  }
  offset++; // Skip INTEGER tag
  const rLength = derSignature[offset++];
  let r = derSignature.slice(offset, offset + rLength);
  offset += rLength;

  // Read s
  if (derSignature[offset] !== 0x02) {
    throw new Error('Invalid DER signature: expected INTEGER tag for s');
  }
  offset++; // Skip INTEGER tag
  const sLength = derSignature[offset++];
  let s = derSignature.slice(offset, offset + sLength);

  // Remove leading zero padding
  if (r.length > 32 && r[0] === 0x00) {
    r = r.slice(1);
  }
  if (s.length > 32 && s[0] === 0x00) {
    s = s.slice(1);
  }

  // Pad to 32 bytes if needed
  if (r.length < 32) {
    r = Buffer.concat([Buffer.alloc(32 - r.length, 0), r]);
  }
  if (s.length < 32) {
    s = Buffer.concat([Buffer.alloc(32 - s.length, 0), s]);
  }

  return Buffer.concat([r.slice(-32), s.slice(-32)]);
}

/**
 * Validate JWT claims (expiration, not before, issued at)
 */
function validateJWTClaims(payload: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const currentTime = Math.floor(Date.now() / 1000);

  // Check expiration (exp)
  if (payload.exp !== undefined) {
    if (typeof payload.exp !== 'number') {
      errors.push('exp claim must be a number');
    } else if (payload.exp < currentTime) {
      errors.push(`Token expired at ${new Date(payload.exp * 1000).toISOString()}`);
    }
  }

  // Check not before (nbf)
  if (payload.nbf !== undefined) {
    if (typeof payload.nbf !== 'number') {
      errors.push('nbf claim must be a number');
    } else if (payload.nbf > currentTime) {
      errors.push(`Token not valid before ${new Date(payload.nbf * 1000).toISOString()}`);
    }
  }

  // Check issued at (iat)
  if (payload.iat !== undefined) {
    if (typeof payload.iat !== 'number') {
      errors.push('iat claim must be a number');
    } else if (payload.iat > currentTime + 60) {
      // Allow 60 seconds clock skew
      errors.push('Token issued in the future');
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * DID Authentication Middleware - ES256 Signature Verification
 * Verifies JWT token signed with ES256 (ECDSA with P-256 curve and SHA-256)
 *
 * Header format: Bearer <JWT_TOKEN>
 * JWT payload must contain: { iss: "did:dcert:...", sub: "did:dcert:...", ... }
 *
 * Process:
 * 1. Extract and decode JWT token
 * 2. Get DID from 'iss' claim in payload
 * 3. Get public key from DID document on blockchain
 * 4. Verify JWT signature using ES256 algorithm
 * 5. Validate iss matches sub and token not expired
 */
export const verifyDIDSignature = async (
  req: RequestWithDID,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: "Authorization header is required. Format: Bearer <JWT_TOKEN>",
      });
      return;
    }

    // Extract token (remove 'Bearer ' prefix)
    const token = authHeader.substring(7);

    // Step 1: Decode JWT without verification first
    let decoded;
    try {
      decoded = decodeJWT(token);
    } catch (error) {
      res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: "Invalid JWT token format",
        error: error instanceof Error ? error.message : "Unknown error"
      });
      return;
    }

    const { header, payload, signature } = decoded;

    // Log decoded JWT for debugging
    logger.debug(`JWT Header: ${JSON.stringify(header)}`);
    logger.debug(`JWT Payload: ${JSON.stringify(payload)}`);
    logger.debug(`Signature (base64url): ${signature}`);

    // Validate JWT header
    if (header.alg !== "ES256" || header.typ !== "JWT") {
      res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: "Invalid JWT header. Expected alg: ES256, typ: JWT",
      });
      return;
    }

    // Validate required claims
    if (!payload.iss || !payload.sub) {
      res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: "JWT payload must contain 'iss' and 'sub' claims",
      });
      return;
    }

    const holderDID = payload.iss;

    // Validate DID format
    if (!holderDID.startsWith("did:dcert:")) {
      res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: "Invalid DID format in 'iss' claim. Expected did:dcert:...",
      });
      return;
    }

    // Validate iss matches sub
    if (payload.iss !== payload.sub) {
      res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: "JWT 'iss' and 'sub' claims must match",
      });
      return;
    }

    // Step 2: Validate JWT claims (expiration, nbf, iat)
    const claimsValidation = validateJWTClaims(payload);
    if (!claimsValidation.valid) {
      res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: "JWT claims validation failed",
        errors: claimsValidation.errors,
      });
      return;
    }

    logger.info(`Verifying JWT signature for DID: ${holderDID}`);

    // Step 3: Get DID document to retrieve public key
    const didDocument = await DIDService.getDIDDocument(holderDID);

    // Check if DID exists
    if (!didDocument.found) {
      res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: "DID not found on blockchain",
        did: holderDID,
      });
      return;
    }

    // Check if DID is active
    if (didDocument.status !== "Active") {
      res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: `DID is not active. Current status: ${didDocument.status}`,
        did: holderDID,
      });
      return;
    }

    // Get public key from DID document
    const keyId = didDocument.keyId;
    const publicKeyHex = didDocument[keyId];

    if (!publicKeyHex) {
      res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: "Public key not found in DID document",
        did: holderDID,
      });
      return;
    }

    logger.debug(`Public key retrieved: ${publicKeyHex}`);

    // Step 4: Verify JWT signature using ES256
    try {
      // Get the message to verify: header.payload (as string, not bytes)
      const parts = token.split('.');
      const messageString = `${parts[0]}.${parts[1]}`;
      const messageBuffer = Buffer.from(messageString, 'utf8');

      logger.debug(`Message string: ${messageString.substring(0, 100)}...`);
      logger.debug(`Message length: ${messageString.length} characters`);

      // Convert signature to Buffer (auto-detect hex or base64url)
      logger.debug(`Converting signature to Buffer...`);
      logger.debug(`Signature string length: ${signature.length} chars`);

      const signatureBuffer = signatureToBuffer(signature);

      logger.debug(`Signature buffer length: ${signatureBuffer.length} bytes`);
      logger.debug(`Signature (full hex): ${signatureBuffer.toString('hex')}`);

      if (signatureBuffer.length >= 32) {
        logger.debug(`Signature (first 32 bytes): ${signatureBuffer.slice(0, 32).toString('hex')}`);
      }
      if (signatureBuffer.length >= 64) {
        logger.debug(`Signature (bytes 32-64): ${signatureBuffer.slice(32, 64).toString('hex')}`);
      }
      if (signatureBuffer.length > 64) {
        logger.debug(`Signature (remaining bytes): ${signatureBuffer.slice(64).toString('hex')}`);
      }

      // Convert public key hex to proper format
      const cleanHex = publicKeyHex.startsWith('0x') ? publicKeyHex.substring(2) : publicKeyHex;
      const publicKeyBuffer = Buffer.from(cleanHex, 'hex');

      logger.debug(`Public key length: ${publicKeyBuffer.length} bytes`);
      logger.debug(`Public key (first byte): 0x${publicKeyBuffer[0].toString(16)}`);

      if (publicKeyBuffer.length !== 65) {
        res.status(HTTP_STATUS.UNAUTHORIZED).json({
          success: false,
          message: `Invalid public key length: expected 65 bytes, got ${publicKeyBuffer.length}`,
        });
        return;
      }

      // Extract X and Y coordinates (skip first byte 0x04)
      const x = publicKeyBuffer.slice(1, 33);
      const y = publicKeyBuffer.slice(33, 65);

      logger.debug(`X coordinate: ${x.toString('hex')}`);
      logger.debug(`Y coordinate: ${y.toString('hex')}`);

      // Create public key using JWK format - ES256 uses P-256 (prime256v1) curve
      let publicKey: crypto.KeyObject;
      try {
        publicKey = crypto.createPublicKey({
          key: {
            kty: 'EC',
            crv: 'P-256',
            x: x.toString('base64url'),
            y: y.toString('base64url'),
          },
          format: 'jwk'
        });

        logger.debug(`Public key created successfully`);

        // Also try PEM format as alternative
        const publicKeyPEM = publicKey.export({ type: 'spki', format: 'pem' }) as string;
        logger.debug(`Public key PEM:\n${publicKeyPEM}`);
      } catch (conversionError) {
        logger.error("Failed to create public key", conversionError);
        res.status(HTTP_STATUS.UNAUTHORIZED).json({
          success: false,
          message: "Failed to create public key from DID document",
        });
        return;
      }

      // Determine signature format and prepare for verification
      let signatureDER: Buffer;
      let signatureRaw: Buffer;

      if (signatureBuffer.length === 64) {
        // Raw format (r||s) - convert to DER
        signatureRaw = signatureBuffer;
        signatureDER = rawSignatureToDER(signatureBuffer);
        logger.debug(`Signature is raw format (64 bytes), converted to DER (${signatureDER.length} bytes)`);
      } else if (signatureBuffer.length >= 70 && signatureBuffer[0] === 0x30) {
        // Already DER format - try to extract raw
        signatureDER = signatureBuffer;
        try {
          signatureRaw = derSignatureToRaw(signatureBuffer);
          logger.debug(`Signature is DER format (${signatureBuffer.length} bytes), extracted raw (${signatureRaw.length} bytes)`);
        } catch (err) {
          logger.warn(`Could not extract raw signature from DER: ${err}`);
          signatureRaw = signatureBuffer; // Fallback
        }
      } else {
        // Unknown format, use as-is
        signatureDER = signatureBuffer;
        signatureRaw = signatureBuffer;
        logger.warn(`Signature has unexpected length: ${signatureBuffer.length} bytes`);
      }

      logger.debug(`DER signature (hex): ${signatureDER.toString('hex')}`);

      // Verify signature using crypto.verify
      // For ES256: ECDSA with P-256 curve and SHA-256 hash
      let isValid = false;
      let verificationMethod = '';

      // Method 1: Try with DER signature and crypto.verify
      try {
        isValid = crypto.verify(
          'sha256',
          messageBuffer,
          {
            key: publicKey,
            dsaEncoding: 'der'
          },
          signatureDER
        );

        verificationMethod = 'crypto.verify with DER';
        logger.debug(`✓ Verification result (Method 1 - DER): ${isValid}`);
      } catch (verifyError) {
        logger.error(`✗ Verification error (Method 1 - DER):`, verifyError);
      }

      // Method 2: Try with createVerify and DER signature
      if (!isValid) {
        try {
          const verifier = crypto.createVerify('sha256');
          verifier.update(messageBuffer);
          isValid = verifier.verify(publicKey, signatureDER);

          verificationMethod = 'createVerify with DER';
          logger.debug(`✓ Verification result (Method 2 - createVerify DER): ${isValid}`);
        } catch (verifyError2) {
          logger.error(`✗ Verification error (Method 2 - createVerify DER):`, verifyError2);
        }
      }

      // Method 3: Try with raw signature if available
      if (!isValid && signatureRaw.length === 64) {
        try {
          const signatureDER2 = rawSignatureToDER(signatureRaw);
          const verifier = crypto.createVerify('sha256');
          verifier.update(messageBuffer);
          isValid = verifier.verify(publicKey, signatureDER2);

          verificationMethod = 'createVerify with raw->DER conversion';
          logger.debug(`✓ Verification result (Method 3 - raw->DER): ${isValid}`);
        } catch (verifyError3) {
          logger.error(`✗ Verification error (Method 3 - raw->DER):`, verifyError3);
        }
      }

      logger.info(`Final verification result: ${isValid} (method: ${verificationMethod})`);

      if (!isValid) {
        logger.error("Signature verification failed", {
          messageLength: messageString.length,
          messageFirst50: messageString.substring(0, 50),
          signatureLength: signatureBuffer.length,
          signatureHex: signatureBuffer.toString('hex').substring(0, 100) + '...',
          publicKeyHex: publicKeyHex.substring(0, 100) + '...'
        });

        res.status(HTTP_STATUS.UNAUTHORIZED).json({
          success: false,
          message: "Invalid JWT signature. Token verification failed",
          did: holderDID,
        });
        return;
      }

      logger.info(`✅ JWT signature verified successfully for DID: ${holderDID}`);

      // Attach DID data and payload to request
      req.holderDID = holderDID;
      req.holderPublicKey = publicKeyHex;
      req.holderRole = payload.role;
      req.tokenPayload = payload;

      next();
    } catch (error) {
      logger.error("Error verifying JWT signature", error);
      res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: "Failed to verify JWT signature",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return;
    }
  } catch (error) {
    logger.error("Error in verifyDIDSignature middleware", error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Internal server error during JWT verification",
    });
  }
};

/**
 * Optional DID Authentication Middleware
 * Same as verifyDIDSignature but allows requests without authentication
 * Useful for endpoints that work with or without authentication
 */
export const optionalVerifyDIDSignature = async (
  req: RequestWithDID,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;

    // If no header, continue without authentication
    if (!authHeader) {
      logger.info("No Authorization header provided - continuing without JWT verification");
      return next();
    }

    // If header exists, verify it
    if (!authHeader.startsWith("Bearer ")) {
      res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: "Invalid Authorization header format. Expected: Bearer <JWT_TOKEN>",
      });
      return;
    }

    // Use the same verification logic
    await verifyDIDSignature(req, res, next);
  } catch (error) {
    logger.error("Error in optionalVerifyDIDSignature middleware", error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Internal server error during optional JWT verification",
    });
  }
};
