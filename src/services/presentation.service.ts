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
    verifier_name: string;
    purpose: string;
    requested_credentials: Array<{
      schema_id: string;
      schema_name: string;
      schema_version: number;
    }>;
  }): Promise<{ vp_request_id: string; message: string }> {
    const vpRequest = await this.db.vPRequest.create({
      data: {
        holder_did: data.holder_did,
        verifier_did: data.verifier_did,
        verifier_name: data.verifier_name,
        purpose: data.purpose,
        requested_credentials: data.requested_credentials,
      },
    });

    // TODO: Add Message Queue using RabbitMQ to notify holder
    logger.success(`VP request created: ${vpRequest.id}`);
    logger.info(`From: ${data.verifier_did} (${data.verifier_name})`);
    logger.info(`To: ${data.holder_did}`);
    logger.info(`Purpose: ${data.purpose}`);

    return {
      vp_request_id: vpRequest.id,
      message: "VP request sent successfully. Awaiting Holder's response.",
    };
  }

  /**
   * Get VP request details by ID
   */
  async getVPRequestDetails(vpReqId: string) {
    const vpRequest = await this.db.vPRequest.findUnique({
      where: { id: vpReqId },
    });

    if (!vpRequest) {
      throw new NotFoundError("VP Request not found");
    }

    return vpRequest;
  }

  /**
   * Get VP requests with filtering
   * @param filters - verifier_did OR holder_did (one must be provided), optional status filter
   */
  async getVPRequests(filters: {
    verifier_did?: string;
    holder_did?: string;
    status?: string;
  }) {
    // Validate: at least one of verifier_did or holder_did must be provided
    if (!filters.verifier_did && !filters.holder_did) {
      throw new Error("Either verifier_did or holder_did must be provided");
    }

    // Build where clause
    const where: any = {};

    if (filters.verifier_did) {
      where.verifier_did = filters.verifier_did;
    }

    if (filters.holder_did) {
      where.holder_did = filters.holder_did;
    }

    if (filters.status) {
      where.status = filters.status;
    }

    const vpRequests = await this.db.vPRequest.findMany({
      where,
      orderBy: {
        createdAt: 'desc'
      }
    });

    return vpRequests;
  }

  /**
   * Accept VP Request
   * Holder accepts VP request and provides vp_id
   */
  async acceptVPRequest(data: {
    vpReqId: string;
    vpId: string;
  }): Promise<{ message: string }> {
    // Check if VP request exists
    const vpRequest = await this.db.vPRequest.findUnique({
      where: { id: data.vpReqId },
    });

    if (!vpRequest) {
      throw new NotFoundError("VP Request not found");
    }

    if (vpRequest.status !== 'PENDING') {
      throw new Error(`Cannot accept VP request with status: ${vpRequest.status}`);
    }

    // Update VP request status to ACCEPT and set vp_id
    await this.db.vPRequest.update({
      where: { id: data.vpReqId },
      data: {
        status: 'ACCEPT',
        vp_id: data.vpId,
      },
    });

    logger.success(`VP request ${data.vpReqId} accepted with VP ${data.vpId}`);

    return {
      message: "VP request accepted successfully",
    };
  }

  /**
   * Decline VP Request
   * Holder declines VP request
   */
  async declineVPRequest(data: {
    vpReqId: string;
  }): Promise<{ message: string }> {
    // Check if VP request exists
    const vpRequest = await this.db.vPRequest.findUnique({
      where: { id: data.vpReqId },
    });

    if (!vpRequest) {
      throw new NotFoundError("VP Request not found");
    }

    if (vpRequest.status !== 'PENDING') {
      throw new Error(`Cannot decline VP request with status: ${vpRequest.status}`);
    }

    // Update VP request status to DECLINE
    await this.db.vPRequest.update({
      where: { id: data.vpReqId },
      data: {
        status: 'DECLINE',
      },
    });

    logger.success(`VP request ${data.vpReqId} declined`);

    return {
      message: "VP request declined successfully",
    };
  }

  /**
   * Claim VP by Verifier
   * Only verifier with matching verifier_did can claim
   */
  async claimVP(data: {
    verifier_did: string;
  }): Promise<{
    vp_sharings: Array<{
      vp_id: string;
      holder_did: string;
      vp: any;
      created_at: Date;
    }>;
  }> {
    // Find VPSharings with matching verifier_did that haven't been claimed yet
    const vpSharings = await this.db.vPSharing.findMany({
      where: {
        verifier_did: data.verifier_did,
        hasClaim: false,
        deletedAt: null,
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    if (vpSharings.length === 0) {
      return {
        vp_sharings: []
      };
    }

    // Mark all as claimed
    await this.db.vPSharing.updateMany({
      where: {
        verifier_did: data.verifier_did,
        hasClaim: false,
        deletedAt: null,
      },
      data: {
        hasClaim: true,
      },
    });

    logger.success(`Verifier ${data.verifier_did} claimed ${vpSharings.length} VPs`);

    // Parse VPs and return
    const result = vpSharings.map(vp => ({
      vp_id: vp.id,
      holder_did: vp.holder_did,
      vp: JSON.parse(vp.VP),
      created_at: vp.createdAt,
    }));

    return {
      vp_sharings: result,
    };
  }

  /**
   * Store VP for sharing
   */
  async storeVP(data: {
    holder_did: string;
    vp: string; // VP is a JSON string
    verifier_did?: string; // Optional: if provided, VP is initiated by verifier request
    is_barcode?: boolean; // Optional: indicates if VP sharing is from barcode scan
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
        verifier_did: data.verifier_did, // NULL if initiated by holder, has value if initiated by verifier
        is_barcode: data.is_barcode ?? false, // Default to false if not provided
        hasClaim: false, // Default to not claimed
      },
    });

    logger.success(`VP stored: ${sharedVp.id}`);
    logger.info(`Holder: ${data.holder_did}`);
    logger.info(`Verifier: ${data.verifier_did || 'N/A (initiated by holder)'}`);
    logger.info(`Is Barcode: ${sharedVp.is_barcode}`);

    return {
      vp_id: sharedVp.id,
      message: "VP stored successfully and is available for retrieval.",
    };
  }

  /**
   * Get and delete VP (one-time retrieval)
   */
  async getVP(vpId: string): Promise<{ vp: any }> {
    // Find VP in VPSharing (exclude soft-deleted)
    const sharedVp = await this.db.vPSharing.findFirst({
      where: {
        id: vpId,
        deletedAt: null
      },
    });

    if (!sharedVp) {
      throw new NotFoundError(
        "VP not found. It may have expired or already been used."
      );
    }

    // Soft delete VP after retrieval (one-time use) - idempotent
    await this.db.vPSharing.update({
      where: { id: vpId },
      data: { deletedAt: new Date() }
    });

    logger.success(`VP retrieved and soft deleted: ${vpId}`);

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
   * Helper: Convert hex public key to ECDSA P-256 public key object
   */
  private hexToECDSAPublicKey(publicKeyHex: string): crypto.KeyObject {
    // Remove '0x' prefix if present
    const cleanHex = publicKeyHex.startsWith('0x')
      ? publicKeyHex.substring(2)
      : publicKeyHex;

    // ECDSA P-256 uncompressed public key is 65 bytes (04 + 32 bytes X + 32 bytes Y)
    // or 64 bytes without the 04 prefix
    let publicKeyBuffer: Buffer;

    if (cleanHex.length === 130) {
      // 65 bytes with 04 prefix
      publicKeyBuffer = Buffer.from(cleanHex, 'hex');
      if (publicKeyBuffer[0] !== 0x04) {
        throw new Error('Invalid ECDSA P-256 public key: expected 04 prefix for uncompressed key');
      }
    } else if (cleanHex.length === 128) {
      // 64 bytes without prefix, add 04 prefix
      publicKeyBuffer = Buffer.concat([Buffer.from([0x04]), Buffer.from(cleanHex, 'hex')]);
    } else {
      throw new Error(`Invalid ECDSA P-256 public key length: expected 128 or 130 hex chars, got ${cleanHex.length}`);
    }

    // Create ECDSA P-256 public key in DER format (SPKI)
    // ASN.1 structure for ECDSA P-256 public key
    const derHeader = Buffer.from([
      0x30, 0x59, // SEQUENCE, length 89
      0x30, 0x13, // SEQUENCE, length 19
      0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01, // OID: 1.2.840.10045.2.1 (ecPublicKey)
      0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07, // OID: 1.2.840.10045.3.1.7 (P-256)
      0x03, 0x42, 0x00 // BIT STRING, length 66, 0 unused bits
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
   * Helper: Verify ECDSA P-256 signature with SHA256 for a credential or presentation
   */
  private async verifyECDSASignature(
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

      // 4. Decode signature from multibase (or handle raw signature)
      let signatureBuffer: Buffer;
      try {
        signatureBuffer = this.decodeMultibase(proof.proofValue);
      } catch (error) {
        // If multibase decoding fails, try to decode as hex or base64
        if (proof.proofValue.startsWith('0x')) {
          signatureBuffer = Buffer.from(proof.proofValue.substring(2), 'hex');
        } else {
          // Try as base64
          signatureBuffer = Buffer.from(proof.proofValue, 'base64');
        }
      }

      // 5. Convert public key hex to ECDSA P-256 KeyObject
      const publicKey = this.hexToECDSAPublicKey(publicKeyHex);

      // 6. Verify signature using ECDSA with SHA256
      const isValid = crypto.verify(
        'sha256', // Use SHA256 hash algorithm
        messageBuffer,
        publicKey,
        signatureBuffer
      );

      logger.debug(`ECDSA P-256 signature verification result: ${isValid}`);
      return isValid;
    } catch (error) {
      logger.error('Error verifying ECDSA signature:', error);
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

      // Verify VC proof using ECDSA P-256 with SHA256
      const isValid = await this.verifyECDSASignature(vc, vc.proof, publicKeyHex);

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
   * Uses ECDSA P-256 curve with SHA256 for signature verification
   *
   * Behavior based on is_barcode:
   * - is_barcode = false: One-time use, soft deleted after verification
   * - is_barcode = true: Reusable, never deleted (for barcode scanning scenarios)
   *
   * Steps:
   * 1. Verify VP signature with holder's public key
   * 2. Verify each VC's proof with issuer's public key
   * 3. Conditionally soft delete based on is_barcode value
   */
  async verifyVP(vpId: string): Promise<VPVerificationResult> {
    // Find VP in VPSharing
    const sharedVp = await this.db.vPSharing.findUnique({
      where: { id: vpId },
    });

    if (!sharedVp) {
      throw new NotFoundError("VP not found");
    }

    // Check if VP is one-time use and already verified
    if (!sharedVp.is_barcode && sharedVp.deletedAt !== null) {
      throw new NotFoundError("VP not found or already verified");
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
            // Verify VP signature using ECDSA P-256 with SHA256
            const isValid = await this.verifyECDSASignature(vp, vp.proof, publicKeyHex);
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
    logger.info(`Is barcode VP: ${sharedVp.is_barcode}`);

    // Step 3: Update VPRequest verify_status if this VP is linked to a request
    try {
      // Check if there's a VPRequest with this vp_id
      const vpRequest = await this.db.vPRequest.findFirst({
        where: { vp_id: vpId }
      });

      if (vpRequest) {
        // Determine verify_status based on verification result
        // VALID if VP signature is valid AND all VCs are valid
        // INVALID otherwise
        const allVCsValid = result.credentials_verification.every(vc => vc.valid);
        const isValid = result.vp_valid && allVCsValid;

        const verify_status = isValid ? 'VALID_VERIFICATION' : 'INVALID_VERIFICATION';

        await this.db.vPRequest.update({
          where: { id: vpRequest.id },
          data: { verify_status }
        });

        logger.success(`VPRequest ${vpRequest.id} verify_status updated to: ${verify_status}`);
      } else {
        logger.info(`No VPRequest found for VP ${vpId} - skipping verify_status update`);
      }
    } catch (error) {
      // Don't fail the verification if VPRequest update fails
      logger.error(`Failed to update VPRequest verify_status for VP ${vpId}:`, error);
    }

    // Step 4: Conditionally soft delete VP based on is_barcode value
    if (!sharedVp.is_barcode) {
      // One-time use VP: soft delete after verification
      try {
        await this.db.vPSharing.updateMany({
          where: {
            id: vpId,
            deletedAt: null // Only update if not already deleted
          },
          data: {
            deletedAt: new Date()
          }
        });
        logger.success(`VP ${vpId} soft deleted after verification (one-time use)`);
      } catch (error) {
        // Don't fail the verification if soft delete fails
        logger.error(`Failed to soft delete VP ${vpId}:`, error);
      }
    } else {
      // Barcode VP: reusable, don't delete
      logger.info(`VP ${vpId} is a barcode VP - not deleted (reusable)`);
    }

    return result;
  }
}

// Export singleton instance for backward compatibility
export default new PresentationService();

// Export class for testing and custom instantiation
export { PresentationService };
