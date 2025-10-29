import { Request, Response, NextFunction } from "express";
import { HTTP_STATUS } from "../constants";
import { logger } from "../config";
import DIDService from "../services/did.service";
import { decodeJWT, verifyJWT, validateJWTClaims } from "../config/jwt-es256";
import { debugJWT, tryAllVerificationMethods, verifyJWTWithNodeCrypto } from "../config/jwt-debug";

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
  
  if (cleanHex.length % 2 !== 0) {
    throw new Error('Hex string must have even length');
  }
  
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < cleanHex.length; i += 2) {
    bytes[i / 2] = parseInt(cleanHex.slice(i, i + 2), 16);
  }
  return bytes;
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

    // Step 4: Verify JWT signature using public key
    try {
      // Convert hex public key to Uint8Array
      const publicKeyBytes = hexToBytes(publicKeyHex);
      logger.debug("Public key converted to bytes", {
        bytesLength: publicKeyBytes.length,
        firstBytes: Array.from(publicKeyBytes.slice(0, 10)).map(b => b.toString(16).padStart(2, '0')).join('')
      });

      // 🔍 DEBUG: Print detailed JWT info
      debugJWT(token, publicKeyHex);
      
      // 🔍 DEBUG: Try all verification methods
      const verificationResults = await tryAllVerificationMethods(token, publicKeyHex);
      
      // Try Node.js crypto method first (often more reliable)
      let isValid = await verifyJWTWithNodeCrypto(token, publicKeyBytes);
      
      // If that fails, try the webcrypto method
      if (!isValid) {
        logger.info("Node.js crypto verification failed, trying webcrypto...");
        isValid = await verifyJWT(token, publicKeyBytes);
      }
      
      logger.debug("JWT signature verification result", {
        did: holderDID,
        isValid
      });

      if (!isValid) {
        logger.warn("JWT signature verification failed", {
          did: holderDID,
          publicKeyHex,
          tokenPreview: token.substring(0, 50) + "...",
          verificationResults
        });
        res.status(HTTP_STATUS.UNAUTHORIZED).json({
          success: false,
          message: "Invalid JWT signature. Token verification failed",
          did: holderDID,
        });
        return;
      }

      logger.success(`✅ JWT signature verified successfully for DID: ${holderDID}`);

      // Attach DID data and payload to request
      req.holderDID = holderDID;
      req.holderPublicKey = publicKeyHex;
      req.holderRole = payload.role;
      req.tokenPayload = payload;

      next();
    } catch (error) {
      logger.error("Error during JWT signature verification", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        did: holderDID,
        publicKeyHex
      });
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