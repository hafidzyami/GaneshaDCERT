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
 * Helper function to convert hex string to Uint8Array
 */
function hexToBytes(hex: string): Uint8Array {
  // Remove any spaces or prefixes
  const cleanHex = hex.replace(/^0x/, '').replace(/\s/g, '');
  
  // Validate hex string
  if (!/^[0-9a-fA-F]*$/.test(cleanHex)) {
    throw new Error('Invalid hex string');
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
function rawPublicKeyToPEM(publicKeyHex: string): string {
  // Remove '0x' prefix if exists
  const cleanHex = publicKeyHex.startsWith('0x') ? publicKeyHex.substring(2) : publicKeyHex;

  // For P-256, uncompressed public key is 65 bytes (130 hex chars): 04 + 32 bytes X + 32 bytes Y
  // Compressed public key is 33 bytes (66 hex chars): 02/03 + 32 bytes X
  const publicKeyBuffer = Buffer.from(cleanHex, 'hex');

  // Create EC public key in PEM format
  const key = crypto.createPublicKey({
    key: publicKeyBuffer,
    format: 'der',
    type: 'spki',
  });

  return key.export({ type: 'spki', format: 'pem' }) as string;
}

/**
 * Convert DER signature to raw signature (r,s) for ES256
 * JWT ES256 signatures are raw (r||s) format, not DER encoded
 */
function derSignatureToRaw(signature: Buffer): Buffer {
  // If signature is already 64 bytes (raw format), return as is
  if (signature.length === 64) {
    return signature;
  }

  // Otherwise, it might be DER encoded - parse it
  // DER format: 0x30 [total-length] 0x02 [r-length] [r] 0x02 [s-length] [s]
  let offset = 0;

  if (signature[offset++] !== 0x30) {
    throw new Error('Invalid DER signature format');
  }

  const totalLength = signature[offset++];

  if (signature[offset++] !== 0x02) {
    throw new Error('Invalid DER signature format - missing r marker');
  }

  const rLength = signature[offset++];
  const r = signature.slice(offset, offset + rLength);
  offset += rLength;

  if (signature[offset++] !== 0x02) {
    throw new Error('Invalid DER signature format - missing s marker');
  }

  const sLength = signature[offset++];
  const s = signature.slice(offset, offset + sLength);

  // Pad r and s to 32 bytes each if needed (for P-256)
  const rPadded = r.length < 32 ? Buffer.concat([Buffer.alloc(32 - r.length), r]) : r.slice(-32);
  const sPadded = s.length < 32 ? Buffer.concat([Buffer.alloc(32 - s.length), s]) : s.slice(-32);

  return Buffer.concat([rPadded, sPadded]);
}

/**
 * Convert raw signature (r||s) to DER format for Node.js crypto verification
 * JWT ES256 signatures are 64 bytes: r (32 bytes) || s (32 bytes)
 * DER format: 0x30 [total-length] 0x02 [r-length] [r] 0x02 [s-length] [s]
 */
function rawSignatureToDER(signature: Buffer): Buffer {
  if (signature.length !== 64) {
    // If not 64 bytes, assume it's already DER
    return signature;
  }

  let r = signature.slice(0, 32);
  let s = signature.slice(32, 64);

  // Remove leading zeros from r, but keep at least one byte
  let rIndex = 0;
  while (rIndex < r.length - 1 && r[rIndex] === 0) {
    rIndex++;
  }
  r = r.slice(rIndex);

  // Remove leading zeros from s, but keep at least one byte
  let sIndex = 0;
  while (sIndex < s.length - 1 && s[sIndex] === 0) {
    sIndex++;
  }
  s = s.slice(sIndex);

  // Add 0x00 prefix if high bit is set (to make it a positive integer in DER)
  if (r[0] & 0x80) {
    r = Buffer.concat([Buffer.from([0x00]), r]);
  }
  if (s[0] & 0x80) {
    s = Buffer.concat([Buffer.from([0x00]), s]);
  }

  // Build DER sequence:
  // 0x30 [total-length] 0x02 [r-length] [r] 0x02 [s-length] [s]
  const totalLength = 2 + r.length + 2 + s.length;

  return Buffer.concat([
    Buffer.from([0x30, totalLength]),  // SEQUENCE tag and length
    Buffer.from([0x02, r.length]),     // INTEGER tag and length for r
    r,                                  // r value
    Buffer.from([0x02, s.length]),     // INTEGER tag and length for s
    s                                   // s value
  ]);
}

/**
 * DID Authentication Middleware
 * Verifies JWT token signed with DID holder's private key
 * 
 * Header format: Bearer <JWT_TOKEN>
 * JWT payload must contain: { iss: "did:dcert:...", sub: "did:dcert:...", ... }
 * 
 * Process:
 * 1. Extract and decode JWT token
 * 2. Get DID from 'iss' claim in payload
 * 3. Get public key from DID document on blockchain
 * 4. Verify JWT signature using public key
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
    logger.info("Starting DID signature verification middleware");
    logger.info("Authorization header received", { authHeaderPresent: !!authHeader });

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
      logger.debug("JWT decoded successfully", {
        header: decoded.header,
        payload: decoded.payload
      });
    } catch (error) {
      logger.error("Failed to decode JWT", {
        error: error instanceof Error ? error.message : String(error)
      });
      res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: "Invalid JWT token format",
        error: error instanceof Error ? error.message : "Unknown error"
      });
      return;
    }

    const { header, payload } = decoded;

    // Log decoded JWT for debugging
    logger.debug(`JWT Header: ${JSON.stringify(header)}`);
    logger.debug(`JWT Payload: ${JSON.stringify(payload)}`);
    logger.debug(`Signature (base64url): ${signature}`);

    // Validate JWT header
    if (header.alg !== "ES256" || header.typ !== "JWT") {
      logger.warn("Invalid JWT header", { header });
      res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: "Invalid JWT header. Expected alg: ES256, typ: JWT",
        received: header
      });
      return;
    }

    // Validate required claims
    if (!payload.iss || !payload.sub) {
      logger.warn("Missing required JWT claims", { payload });
      res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: "JWT payload must contain 'iss' and 'sub' claims",
      });
      return;
    }

    const holderDID = payload.iss;

    // Validate DID format
    if (!holderDID.startsWith("did:dcert:")) {
      logger.warn("Invalid DID format", { holderDID });
      res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: "Invalid DID format in 'iss' claim. Expected did:dcert:...",
        received: holderDID
      });
      return;
    }

    // Validate iss matches sub
    if (payload.iss !== payload.sub) {
      logger.warn("JWT claims mismatch", { iss: payload.iss, sub: payload.sub });
      res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: "JWT 'iss' and 'sub' claims must match",
      });
      return;
    }

    // Step 2: Validate JWT claims (expiration, nbf, iat)
    const claimsValidation = validateJWTClaims(payload);
    if (!claimsValidation.valid) {
      logger.warn("JWT claims validation failed", {
        did: holderDID,
        errors: claimsValidation.errors
      });
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
      logger.warn("DID not found on blockchain", { did: holderDID });
      res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: "DID not found on blockchain",
        did: holderDID,
      });
      return;
    }

    // Check if DID is active
    if (didDocument.status !== "Active") {
      logger.warn("DID is not active", {
        did: holderDID,
        status: didDocument.status
      });
      res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: `DID is not active. Current status: ${didDocument.status}`,
        did: holderDID,
      });
      return;
    }

    // Get public key from DID document
    const keyId = didDocument.keyId; // e.g., "#key-1"
    const publicKeyHex = didDocument[keyId]; // Get public key from the keyId field

    if (!publicKeyHex) {
      logger.error("Public key not found in DID document", {
        did: holderDID,
        keyId,
        availableKeys: Object.keys(didDocument)
      });
      res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: "Public key not found in DID document",
        did: holderDID,
      });
      return;
    }

    logger.debug("Public key retrieved from DID document", {
      did: holderDID,
      publicKeyHex,
      publicKeyLength: publicKeyHex.length
    });

    // Verify JWT signature using ES256 (ECDSA with P-256 and SHA-256)
    try {
      // Get the message to verify (header.payload) - standard JWT
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

      // Check if public key is in correct format (uncompressed: 0x04 + 32 bytes X + 32 bytes Y)
      if (publicKeyBuffer.length !== 65 || publicKeyBuffer[0] !== 0x04) {
        res.status(HTTP_STATUS.UNAUTHORIZED).json({
          success: false,
          message: `Invalid public key format. Expected 65 bytes starting with 0x04, got ${publicKeyBuffer.length} bytes starting with 0x${publicKeyBuffer[0].toString(16)}`,
          did: holderDID,
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
          message: "Failed to create public key from coordinates",
          did: holderDID,
          error: conversionError instanceof Error ? conversionError.message : "Unknown error"
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
          signatureLength: signatureDER.length,
          signatureHex: signatureDER.toString('hex'),
          publicKeyHex: publicKeyHex.substring(0, 66) + "...",
        });

        res.status(HTTP_STATUS.UNAUTHORIZED).json({
          success: false,
          message: "Invalid JWT signature. Token verification failed",
          did: holderDID,
        });
        return;
      }

      logger.success(`✅ JWT signature verified successfully for DID: ${holderDID} using ES256`);

      // Attach DID data and payload to request
      req.holderDID = holderDID;
      req.holderPublicKey = publicKeyHex;
      req.holderRole = payload.role;
      req.tokenPayload = payload;

      next();
    } catch (error) {
      logger.error("Error verifying JWT signature with ES256", error);
      res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: "Failed to verify JWT signature",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return;
    }
  } catch (error) {
    logger.error("Error in verifyDIDSignature middleware", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
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
    logger.error("Error in optionalVerifyDIDSignature middleware", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Internal server error during optional JWT verification",
    });
  }
};