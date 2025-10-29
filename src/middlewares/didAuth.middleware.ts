import { Request, Response, NextFunction } from "express";
import { HTTP_STATUS } from "../constants";
import { logger } from "../config";
import DIDService from "../services/did.service";

// Dynamic import untuk @noble/secp256k1 (ES Module)
let secp: any = null;

async function loadSecp() {
  if (!secp) {
    secp = await import("@noble/secp256k1");
  }
  return secp;
}

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
 * Helper function to decode JWT without verification
 */
function decodeJWT(token: string): { header: any; payload: any; signature: string } {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid JWT format');
  }

  const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
  const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
  const signature = parts[2];

  return { header, payload, signature };
}

/**
 * Helper function to convert base64url to hex
 */
function base64urlToHex(base64url: string): string {
  // Convert base64url to base64
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  // Decode base64 to bytes
  const bytes = Buffer.from(base64, 'base64');
  // Convert bytes to hex
  return bytes.toString('hex');
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
 * 4. Verify JWT signature (signs "header.payload") using public key
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

    // Decode JWT without verification first
    let decoded;
    try {
      decoded = decodeJWT(token);
    } catch (error) {
      res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: "Invalid JWT token format",
      });
      return;
    }

    const { header, payload, signature } = decoded;

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
        message: "Invalid DID format in 'iss' claim",
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

    // Check token expiration
    if (payload.exp) {
      const now = Math.floor(Date.now() / 1000);
      if (now > payload.exp) {
        res.status(HTTP_STATUS.UNAUTHORIZED).json({
          success: false,
          message: "JWT token has expired",
        });
        return;
      }
    }

    logger.info(`Verifying JWT signature for DID: ${holderDID}`);

    // Get DID document to retrieve public key
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
    const keyId = didDocument.keyId; // e.g., "#key-1"
    const publicKeyHex = didDocument[keyId]; // Get public key from the keyId field

    if (!publicKeyHex) {
      res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: "Public key not found in DID document",
        did: holderDID,
      });
      return;
    }

    logger.debug(`Public key retrieved: ${publicKeyHex}`);

    // Verify JWT signature
    try {
      // Load secp256k1 module dynamically
      const secpModule = await loadSecp();
      
      // Get the message to verify (header.payload) - standard JWT
      const parts = token.split('.');
      const message = `${parts[0]}.${parts[1]}`;
      const messageBytes = new TextEncoder().encode(message);

      // Convert signature from base64url to hex
      const signatureHex = base64urlToHex(signature);
      const signatureBytes = secpModule.etc.hexToBytes(signatureHex);
      
      // Convert public key to bytes
      const publicKeyBytes = secpModule.etc.hexToBytes(publicKeyHex);

      // Verify JWT signature using secp256k1
      // This verifies that the signature was created by signing "header.payload" with the private key
      const isValid = await secpModule.verify(signatureBytes, messageBytes, publicKeyBytes);

      if (!isValid) {
        res.status(HTTP_STATUS.UNAUTHORIZED).json({
          success: false,
          message: "Invalid JWT signature. Token verification failed",
          did: holderDID,
        });
        return;
      }

      logger.success(`JWT signature verified successfully for DID: ${holderDID}`);

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