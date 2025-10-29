import BlockchainService from "./blockchain/didBlockchain.service";
import { BadRequestError, NotFoundError } from "../utils/errors/AppError";
import { PrismaClient } from "@prisma/client";
import { prisma } from "../config/database";

/**
 * DID Service with Dependency Injection
 * Handles DID operations (registration, rotation, deactivation)
 */
class DIDService {
  private blockchainService: typeof BlockchainService;
  private prisma: PrismaClient;

  /**
   * Constructor with dependency injection
   * @param dependencies - Optional dependencies for testing
   */
  constructor(dependencies?: {
    blockchainService?: typeof BlockchainService;
    prisma?: PrismaClient;
  }) {
    this.blockchainService =
      dependencies?.blockchainService || BlockchainService;
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

      return {
        message: "Institutional DID registered successfully",
        did: did_string,
        institution: {
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
      return {
        found: false,
        error: "Not Found",
        message: "DID not found on blockchain",
        did,
      };
    }

    // Rotate key
    const receipt = await this.blockchainService.registerNewKey(
      did,
      newPublicKey
    );

    return {
      found: true,
      message: "DID key rotated successfully",
      did,
      transactionHash: receipt.hash,
      blockNumber: receipt.blockNumber,
    };
  }

  /**
   * Deactivate DID
   * Returns 200 with found status instead of throwing NotFoundError
   */
  async deactivateDID(did: string) {
    // Check if DID exists
    const exists = await this.blockchainService.isDIDRegistered(did);
    if (!exists) {
      return {
        found: false,
        error: "Not Found",
        message: "DID not found on blockchain",
        did,
      };
    }

    // Deactivate DID
    const receipt = await this.blockchainService.deactivateDID(did);

    // TODO: Trigger batch revocation for all associated VCs via message queue

    return {
      found: true,
      message: "DID deactivated successfully",
      did,
      transactionHash: receipt.hash,
      blockNumber: receipt.blockNumber,
    };
  }

  /**
   * Get DID Document
   * Returns 200 with found status instead of throwing NotFoundError
   */
  async getDIDDocument(did: string) {
    const document = await this.blockchainService.getDIDDocument(did);

    // If DID not found, return the error response with 200 status
    if (!document.found) {
      return document;
    }

    return {
      message: "DID document retrieved successfully",
      ...document,
    };
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
