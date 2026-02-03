import BlockchainService from "./blockchain/didBlockchain.service";
import InstitutionService from "./institution.service";
import CacheService from "./cache.service";
import { BadRequestError, NotFoundError } from "../utils/errors/AppError";
import { PrismaClient, RequestStatus } from "@prisma/client";
import { prisma } from "../config/database";
import { logger } from "../config";
import { encryptWithPublicKey } from "../utils/encryptUtil";

/**
 * DID Service with Dependency Injection
 * Handles DID operations (registration, rotation, deactivation)
 */
class DIDService {
  private blockchainService: typeof BlockchainService;
  private cacheService: typeof CacheService;
  private prisma: PrismaClient;

  /**
   * Constructor with dependency injection
   * @param dependencies - Optional dependencies for testing
   */
  constructor(dependencies?: {
    blockchainService?: typeof BlockchainService;
    cacheService?: typeof CacheService;
    prisma?: PrismaClient;
  }) {
    this.blockchainService =
      dependencies?.blockchainService || BlockchainService;
    this.cacheService = dependencies?.cacheService || CacheService;
    this.prisma = dependencies?.prisma || prisma;
  }

  /**
   * Register new DID
   */
  async registerDID(data: {
    did_string: string;
    public_key: string;
    role: string;
    email?: string;
  }) {
    const { did_string, public_key, role, email } = data;

    // Check if DID already exists
    const didExists = await this.blockchainService.isDIDRegistered(did_string);
    if (didExists) {
      throw new BadRequestError("A DID Document already exists with this DID.");
    }

    // Determine role type
    const isIndividual = role.toLowerCase() === "individual";

    if (isIndividual) {
      // Register individual DID
      const receipt = await this.blockchainService.registerIndividualDID(
        did_string,
        public_key
      );

      // Invalidate any stale cache entry (in case of re-registration after deactivation)
      await this.cacheService.invalidateDID(did_string);

      return {
        message: "Individual DID registered successfully",
        did: did_string,
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
      };
    } else {
      // For institution, email is required
      if (!email) {
        throw new BadRequestError("Email is required for institution role");
      }

      // Query institution data from InstitutionRegistration based on email
      const institution = await this.prisma.institutionRegistration.findUnique({
        where: { email },
        select: {
          name: true,
          phone: true,
          country: true,
          website: true,
          address: true,
          status: true,
        },
      });

      logger.info(
        `Queried institution data for email ${email}: ${JSON.stringify(
          institution
        )}`
      );

      if (!institution) {
        throw new NotFoundError(
          `Institution with email ${email} not found in registration database`
        );
      }

      // Check if institution is approved
      if (institution.status !== "APPROVED") {
        throw new BadRequestError(
          `Institution registration is not approved. Current status: ${institution.status}`
        );
      }

      // Register institutional DID with queried data
      const receipt = await this.blockchainService.registerInstitutionalDID(
        did_string,
        public_key,
        email,
        institution.name,
        institution.phone,
        institution.country,
        institution.website,
        institution.address
      );

      // Insert institution data to Institution table
      const createdInstitution = await InstitutionService.createInstitution({
        did: did_string,
        email,
        name: institution.name,
        phone: institution.phone,
        country: institution.country,
        website: institution.website,
        address: institution.address,
      });

      // Invalidate any stale cache entry (in case of re-registration after deactivation)
      await this.cacheService.invalidateDID(did_string);

      return {
        message: "Institutional DID registered successfully",
        did: did_string,
        institution: {
          id: createdInstitution.id,
          email,
          name: institution.name,
          phone: institution.phone,
          country: institution.country,
          website: institution.website,
          address: institution.address,
        },
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
      };
    }
  }

  /**
   * Check if DID exists
   * Returns 200 with found status instead of throwing NotFoundError
   */
  async checkDID(did: string) {
    const exists = await this.blockchainService.isDIDRegistered(did);

    if (!exists) {
      return {
        found: false,
        error: "Not Found",
        message: "DID not found on blockchain",
        did,
      };
    }

    return {
      found: true,
      message: "DID exists",
      did,
    };
  }

  /**
   * Get number of blocks on blockchain
   */
  async getBlockCount() {
    const blockNumber = await this.blockchainService.getBlockNumber();

    return {
      message: "Number of blocks retrieved",
      blockCount: blockNumber,
    };
  }

  /**
   * Rotate DID key
   * Returns 200 with found status instead of throwing NotFoundError
   */
  async rotateKey(did: string, newPublicKey: string) {
    // Check if DID exists
    const exists = await this.blockchainService.isDIDRegistered(did);
    if (!exists) {
      throw new NotFoundError("DID not found on blockchain");
    }

    // Rotate key
    const receipt = await this.blockchainService.registerNewKey(
      did,
      newPublicKey
    );

    // Invalidate cache since public key has changed
    await this.cacheService.invalidateDID(did);
    logger.info(`[DIDService] Cache invalidated after key rotation for DID: ${did}`);

    return {
      message: "DID key rotated successfully",
      did,
      transactionHash: receipt.hash,
      blockNumber: receipt.blockNumber,
    };
  }

  /**
   * Deactivate DID
   * Throws NotFoundError if DID doesn't exist
   */
  async deactivateDID(did: string) {
    // Check if DID exists
    const exists = await this.blockchainService.isDIDRegistered(did);
    if (!exists) {
      throw new NotFoundError("DID not found on blockchain");
    }

    // Query all VCs owned by this holder from IssuerVCData
    const vcs = await this.prisma.issuerVCData.findMany({
      where: {
        holder_did: did,
      },
      select: {
        vc_id: true,
        issuer_did: true,
      },
    });

    logger.info(
      `Found ${vcs.length} VCs owned by DID ${did} to create revoke requests`
    );

    // Create revoke request for each VC to its issuer
    let requestCount = 0;
    const reason = "The holder’s DID document has been deactivated";

    for (const vc of vcs) {
      // Skip if vc_id is null (legacy data)
      if (!vc.vc_id || !vc.issuer_did) {
        logger.warn(`Skipping VC with null vc_id or issuer_did`);
        continue;
      }

      try {
        // Get issuer's public key from blockchain
        const issuerDIDDocument = await this.blockchainService.getDIDDocument(
          vc.issuer_did
        );

        if (!issuerDIDDocument.found) {
          logger.warn(
            `Issuer DID ${vc.issuer_did} not found on blockchain, skipping VC ${vc.vc_id}`
          );
          continue;
        }

        // Get public key using keyId
        const issuerKeyId = issuerDIDDocument.keyId;
        const issuerPublicKey = issuerDIDDocument[issuerKeyId];

        // Encrypt the revoke request body with issuer's public key
        const requestBody = {
          vc_id: vc.vc_id,
          reason: reason,
        };

        const encryptedBody = await encryptWithPublicKey(
          requestBody,
          issuerPublicKey
        );

        // Create revoke request in database
        await this.prisma.vCRevokeRequest.create({
          data: {
            issuer_did: vc.issuer_did,
            holder_did: did,
            encrypted_body: encryptedBody,
            status: RequestStatus.PENDING,
          },
        });

        requestCount++;
        logger.info(
          `✅ Successfully created revoke request for VC ${vc.vc_id} to issuer ${vc.issuer_did}`
        );
      } catch (error: any) {
        // Log error but continue with other VCs
        console.error(
          `❌ Failed to create revoke request for VC ${vc.vc_id}:`,
          error.message
        );
        logger.error(
          `Failed to create revoke request for VC ${vc.vc_id}: ${error.message}`
        );
      }
    }

    // Deactivate DID
    const receipt = await this.blockchainService.deactivateDID(did);

    // Invalidate cache since DID status has changed
    await this.cacheService.invalidateDID(did);
    logger.info(`[DIDService] Cache invalidated after deactivation for DID: ${did}`);

    logger.success(
      `DID ${did} deactivated successfully. Created ${requestCount}/${vcs.length} revoke requests.`
    );

    return {
      message: `DID deactivated successfully. ${requestCount} revoke requests have been created.`,
      did,
      revokeRequestsCount: requestCount,
      transactionHash: receipt.hash,
      blockNumber: receipt.blockNumber,
    };
  }

  /**
   * Get DID Document
   * Returns W3C-compliant DID document format
   * Uses Redis cache to improve performance (TTL: 1 hour)
   */
  async getDIDDocument(did: string) {
    // Try to get from cache first
    const cached = await this.cacheService.getDIDDocument(did);
    if (cached) {
      logger.debug(`[DIDService] Cache hit for DID Document: ${did}`);
      // Update the retrieved timestamp for cached response
      return {
        ...cached,
        didResolutionMetadata: {
          ...cached.didResolutionMetadata,
          retrieved: new Date().toISOString(),
          cached: true,
        },
      };
    }

    logger.debug(`[DIDService] Cache miss for DID Document: ${did}, fetching from blockchain`);

    // Cache miss - fetch from blockchain
    const document = await this.blockchainService.getDIDDocument(did);

    // If DID not found, return the error response (don't cache not-found)
    if (!document.found) {
      return document;
    }

    // Build W3C-compliant DID Document
    const keyId = `${did}#key-1`;
    const publicKeyHex = document[document.keyId]; // Get public key from keyId field

    // Build service endpoints for institutional DIDs
    const services: any[] = [];
    if (document.role === "Institutional" && document.details) {
      services.push({
        id: `${did}#institution`,
        type: "InstitutionalProfile",
        serviceEndpoint: {
          name: document.details.name || "",
          email: document.details.email || "",
          phone: document.details.phone || "",
          country: document.details.country || "",
          website: document.details.website || "",
          address: document.details.address || "",
        },
      });
    }

    // Build DID Document in W3C format
    const didDocument: any = {
      "@context": [
        "https://www.w3.org/ns/did/v1.1",
        "https://w3id.org/security/suites/secp256k1-2019/v1",
      ],
      id: did,
      controller: did,
      verificationMethod: [
        {
          id: keyId,
          type: "EcdsaSecp256k1VerificationKey2019",
          controller: did,
          publicKeyHex: publicKeyHex,
        },
      ],
      authentication: [keyId],
      assertionMethod: [keyId],
    };

    // Add services for institutional DIDs
    if (services.length > 0) {
      didDocument.service = services;
    }

    const result = {
      found: true,
      status: document.status,
      keyId: document.keyId,
      [document.keyId]: publicKeyHex,
      message: "DID document retrieved successfully",
      didDocument,
      didDocumentMetadata: {
        deactivated: document.status === "InActive",
      },
      didResolutionMetadata: {
        contentType: "application/did+ld+json",
        retrieved: new Date().toISOString(),
        cached: false,
      },
    };

    // Cache the result (only cache active DIDs)
    if (document.status !== "InActive") {
      await this.cacheService.setDIDDocument(did, result);
      logger.debug(`[DIDService] Cached DID Document: ${did}`);
    }

    return result;
  }

  /**
   * Cleanup method to disconnect Prisma client
   * Should be called when the service is no longer needed
   */
  async disconnect() {
    await this.prisma.$disconnect();
  }
}

// Export singleton instance with shared Prisma client for backward compatibility
const prismaClient = new PrismaClient();
const didServiceInstance = new DIDService({ prisma: prismaClient });

export default didServiceInstance;

// Export class for testing and custom instantiation
export { DIDService };
