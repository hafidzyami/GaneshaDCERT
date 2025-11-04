import { VPRequest, VPSharing, PrismaClient } from "@prisma/client";
import { prisma } from "../config/database";
import { NotFoundError } from "../utils/errors/AppError";
import logger from "../config/logger";
import * as crypto from "crypto";
import DIDService from "./did.service";

/**
 * Data Integrity Proof Structure
 */
interface DataIntegrityProof {
  type: string;
  cryptosuite: string;
  created: string;
  verificationMethod: string;
  proofPurpose: string;
  proofValue: string;
}

/**
 * Verifiable Credential Structure
 */
interface VerifiableCredential {
  '@context': string[];
  id: string;
  type: string[];
  issuer: string;
  issuerName?: string;
  validFrom: string;
  credentialSubject: {
    id: string;
    [key: string]: string | number | boolean;
  };
  proof: DataIntegrityProof;
}

/**
 * Verifiable Presentation Structure
 */
interface VerifiablePresentation {
  '@context': string[];
  type: string[];
  holder?: string;
  verifiableCredential: VerifiableCredential[];
  proof?: DataIntegrityProof;
  [key: string]: any;
}

/**
 * VC Verification Result
 */
interface VCVerificationResult {
  vc_id: string;
  issuer: string;
  valid: boolean;
  error?: string;
}

/**
 * VP Verification Result
 */
interface VPVerificationResult {
  vp: VerifiablePresentation;
  vp_valid: boolean;
  vp_error?: string;
  holder_did?: string;
  credentials_verification: VCVerificationResult[];
}

/**
 * Presentation Service with Dependency Injection
 * Handles Verifiable Presentation (VP) request and sharing operations
 */
class PresentationService {
  private db: PrismaClient;

  /**
   * Constructor with dependency injection
   * @param dependencies - Optional dependencies for testing
   */
  constructor(dependencies?: {
    db?: PrismaClient;
  }) {
    this.db = dependencies?.db || prisma;
  }

  /**
   * Verifier requests a VP from holder
   */
  async requestVP(data: {
    holder_did: string;
    verifier_did: string;
    list_schema_id: string[];
  }): Promise<{ vp_request_id: string; message: string }> {
    const vpRequest = await this.db.vPRequest.create({
      data: {
        holder_did: data.holder_did,
        verifier_did: data.verifier_did,
        list_schema_id: data.list_schema_id,
      },
    });

    // TODO: Add Message Queue using RabbitMQ to notify holder
    logger.success(`VP request created: ${vpRequest.id}`);
    logger.info(`From: ${data.verifier_did}`);
    logger.info(`To: ${data.holder_did}`);

    return {
      vp_request_id: vpRequest.id,
      message: "VP request sent successfully. Awaiting Holder's response.",
    };
  }

  /**
   * Get VP request details
   */
  async getVPRequestDetails(vpReqId: string): Promise<{
    verifier_did: string;
    list_schema_id: string[];
  }> {
    const vpRequest = await this.db.vPRequest.findUnique({
      where: { id: vpReqId },
    });

    if (!vpRequest) {
      throw new NotFoundError("VP Request not found");
    }

    return {
      verifier_did: vpRequest.verifier_did,
      list_schema_id: vpRequest.list_schema_id,
    };
  }

  /**
   * Store VP for sharing
   */
  async storeVP(data: {
    holder_did: string;
    vp: string; // VP is a JSON string
  }): Promise<{ vp_id: string; message: string }> {
    // Validate that VP is valid JSON
    try {
      JSON.parse(data.vp);
    } catch (error) {
      throw new Error("VP must be a valid JSON string");
    }

    const sharedVp = await this.db.vPSharing.create({
      data: {
        holder_did: data.holder_did,
        VP: data.vp, // Store as string
      },
    });

    logger.success(`VP stored: ${sharedVp.id}`);
    logger.info(`Holder: ${data.holder_did}`);

    return {
      vp_id: sharedVp.id,
      message: "VP stored successfully and is available for retrieval.",
    };
  }

  /**
   * Get and delete VP (one-time retrieval)
   */
  async getVP(vpId: string): Promise<{ vp: any }> {
    // Find VP in VPSharing
    const sharedVp = await this.db.vPSharing.findUnique({
      where: { id: vpId },
    });

    if (!sharedVp) {
      throw new NotFoundError(
        "VP not found. It may have expired or already been used."
      );
    }

    // Delete VP after retrieval (one-time use)
    await this.db.vPSharing.delete({
      where: { id: vpId },
    });

    logger.success(`VP retrieved and deleted: ${vpId}`);

    // Parse VP string to JSON object
    const vpObject = JSON.parse(sharedVp.VP);

    return {
      vp: vpObject,
    };
  }

  /**
   * Helper: Decode multibase-encoded value (base58btc with 'z' prefix)
   */
  private decodeMultibase(encoded: string): Buffer {
    // Remove 'z' prefix (indicates base58btc encoding)
    if (!encoded.startsWith('z')) {
      throw new Error('Invalid multibase encoding: expected z prefix');
    }

    const base58String = encoded.substring(1);

    // Base58 alphabet (Bitcoin/IPFS alphabet)
    const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

    // Decode base58 to bytes
    let decoded = BigInt(0);
    for (let i = 0; i < base58String.length; i++) {
      const char = base58String[i];
      const value = ALPHABET.indexOf(char);
      if (value === -1) {
        throw new Error(`Invalid base58 character: ${char}`);
      }
      decoded = decoded * BigInt(58) + BigInt(value);
    }

    // Convert BigInt to Buffer
    const hex = decoded.toString(16).padStart(64, '0'); // Ed25519 signatures are 64 bytes = 128 hex chars
    return Buffer.from(hex, 'hex');
  }

  /**
   * Helper: Convert hex public key to Ed25519 public key object
   */
  private hexToPublicKey(publicKeyHex: string): crypto.KeyObject {
    // Remove '0x' prefix if present
    const cleanHex = publicKeyHex.startsWith('0x')
      ? publicKeyHex.substring(2)
      : publicKeyHex;

    // Ed25519 public key is 32 bytes
    if (cleanHex.length !== 64) {
      throw new Error(`Invalid Ed25519 public key length: expected 64 hex chars, got ${cleanHex.length}`);
    }

    const publicKeyBuffer = Buffer.from(cleanHex, 'hex');

    // Create Ed25519 public key in DER format (SPKI)
    // ASN.1 structure for Ed25519 public key
    const derHeader = Buffer.from([
      0x30, 0x2a, // SEQUENCE, length 42
      0x30, 0x05, // SEQUENCE, length 5
      0x06, 0x03, 0x2b, 0x65, 0x70, // OID: 1.3.101.112 (Ed25519)
      0x03, 0x21, 0x00 // BIT STRING, length 33, 0 unused bits
    ]);

    const derKey = Buffer.concat([derHeader, publicKeyBuffer]);

    // Create public key object
    return crypto.createPublicKey({
      key: derKey,
      format: 'der',
      type: 'spki'
    });
  }

  /**
   * Helper: Verify EdDSA signature for a credential or presentation
   */
  private async verifyEdDSASignature(
    data: any,
    proof: DataIntegrityProof,
    publicKeyHex: string
  ): Promise<boolean> {
    try {
      // 1. Remove proof from data
      const { proof: _, ...dataWithoutProof } = data;

      // 2. Canonicalize the data (simple JSON stringification for now)
      // Note: For production, use RDF Dataset Canonicalization (RDFC 1.0)
      const canonicalData = JSON.stringify(dataWithoutProof, Object.keys(dataWithoutProof).sort());

      // 3. Create message buffer
      const messageBuffer = Buffer.from(canonicalData, 'utf8');

      // 4. Decode signature from multibase
      const signatureBuffer = this.decodeMultibase(proof.proofValue);

      // 5. Convert public key hex to KeyObject
      const publicKey = this.hexToPublicKey(publicKeyHex);

      // 6. Verify signature using Ed25519
      const isValid = crypto.verify(
        null, // Ed25519 doesn't use a hash algorithm (it's built-in)
        messageBuffer,
        publicKey,
        signatureBuffer
      );

      logger.debug(`EdDSA signature verification result: ${isValid}`);
      return isValid;
    } catch (error) {
      logger.error('Error verifying EdDSA signature:', error);
      return false;
    }
  }

  /**
   * Verify a single VC's proof
   */
  private async verifyVCProof(vc: VerifiableCredential): Promise<VCVerificationResult> {
    try {
      // Get issuer DID
      const issuerDID = vc.issuer;

      // Get issuer's public key from blockchain
      const didDocument = await DIDService.getDIDDocument(issuerDID);

      if (!didDocument.found) {
        return {
          vc_id: vc.id,
          issuer: issuerDID,
          valid: false,
          error: 'Issuer DID not found on blockchain'
        };
      }

      if (didDocument.status !== 'Active') {
        return {
          vc_id: vc.id,
          issuer: issuerDID,
          valid: false,
          error: `Issuer DID is not active. Status: ${didDocument.status}`
        };
      }

      // Get public key
      const keyId = didDocument.keyId;
      const publicKeyHex = didDocument[keyId];

      if (!publicKeyHex) {
        return {
          vc_id: vc.id,
          issuer: issuerDID,
          valid: false,
          error: 'Public key not found in issuer DID document'
        };
      }

      // Verify VC proof
      const isValid = await this.verifyEdDSASignature(vc, vc.proof, publicKeyHex);

      return {
        vc_id: vc.id,
        issuer: issuerDID,
        valid: isValid,
        error: isValid ? undefined : 'Signature verification failed'
      };
    } catch (error) {
      logger.error(`Error verifying VC ${vc.id}:`, error);
      return {
        vc_id: vc.id,
        issuer: vc.issuer,
        valid: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Verify Verifiable Presentation
   * 1. Verify VP signature with holder's public key
   * 2. Verify each VC's proof with issuer's public key
   */
  async verifyVP(vpId: string): Promise<VPVerificationResult> {
    // Find VP in VPSharing (don't delete yet)
    const sharedVp = await this.db.vPSharing.findUnique({
      where: { id: vpId },
    });

    if (!sharedVp) {
      throw new NotFoundError("VP not found");
    }

    // Parse VP string to JSON object
    const vp: VerifiablePresentation = JSON.parse(sharedVp.VP) as VerifiablePresentation;
    const holderDID = sharedVp.holder_did;

    logger.info(`Verifying VP ${vpId} from holder ${holderDID}`);

    // Initialize result
    const result: VPVerificationResult = {
      vp,
      vp_valid: false,
      holder_did: holderDID,
      credentials_verification: []
    };

    // Step 1: Verify VP signature (if VP has proof)
    if (vp.proof && holderDID) {
      try {
        // Get holder's public key from blockchain
        const didDocument = await DIDService.getDIDDocument(holderDID);

        if (!didDocument.found) {
          result.vp_valid = false;
          result.vp_error = 'Holder DID not found on blockchain';
        } else if (didDocument.status !== 'Active') {
          result.vp_valid = false;
          result.vp_error = `Holder DID is not active. Status: ${didDocument.status}`;
        } else {
          // Get public key
          const keyId = didDocument.keyId;
          const publicKeyHex = didDocument[keyId];

          if (!publicKeyHex) {
            result.vp_valid = false;
            result.vp_error = 'Public key not found in holder DID document';
          } else {
            // Verify VP signature
            const isValid = await this.verifyEdDSASignature(vp, vp.proof, publicKeyHex);
            result.vp_valid = isValid;
            if (!isValid) {
              result.vp_error = 'VP signature verification failed';
            }
          }
        }
      } catch (error) {
        logger.error('Error verifying VP signature:', error);
        result.vp_valid = false;
        result.vp_error = error instanceof Error ? error.message : 'Unknown error';
      }
    } else {
      // VP doesn't have proof or holder DID
      result.vp_valid = false;
      result.vp_error = 'VP does not have a proof or holder DID';
    }

    // Step 2: Verify each VC in the VP
    const credentials = Array.isArray(vp.verifiableCredential)
      ? vp.verifiableCredential
      : [vp.verifiableCredential];

    for (const vc of credentials) {
      const vcResult = await this.verifyVCProof(vc);
      result.credentials_verification.push(vcResult);
    }

    logger.success(`VP verification completed for ${vpId}`);
    logger.info(`VP valid: ${result.vp_valid}`);
    logger.info(`VCs verified: ${result.credentials_verification.length}`);
    logger.info(`VCs valid: ${result.credentials_verification.filter(r => r.valid).length}`);

    return result;
  }
}

// Export singleton instance for backward compatibility
export default new PresentationService();

// Export class for testing and custom instantiation
export { PresentationService };
