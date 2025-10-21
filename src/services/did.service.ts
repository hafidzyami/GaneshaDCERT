import BlockchainService from "./blockchain/didsBlockchain.service";
import { BadRequestError, NotFoundError } from "../utils/errors/AppError";

/**
 * DID Service
 * Handles DID operations (registration, rotation, deactivation)
 */
class DIDService {
  /**
   * Register new DID
   */
  async registerDID(data: {
    did_string: string;
    public_key: string;
    role: string;
    email?: string;
    name?: string;
    phone?: string;
    country?: string;
    website?: string;
    address?: string;
  }) {
    const {
      did_string,
      public_key,
      role,
      email,
      name,
      phone,
      country,
      website,
      address,
    } = data;

    // Check if DID already exists
    const didExists = await BlockchainService.isDIDRegistered(did_string);
    if (didExists) {
      throw new BadRequestError("A DID Document already exists with this DID.");
    }

    // Determine role type
    const isIndividual = role.toLowerCase() === "individual";

    if (isIndividual) {
      // Register individual DID
      const receipt = await BlockchainService.registerIndividualDID(
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
      // Validate institutional data
      if (!email || !name || !phone || !country || !website || !address) {
        throw new BadRequestError(
          "All institutional properties (email, name, phone, country, website, address) are required"
        );
      }

      // Register institutional DID
      const receipt = await BlockchainService.registerInstitutionalDID(
        did_string,
        public_key,
        email,
        name,
        phone,
        country,
        website,
        address
      );

      return {
        message: "Institutional DID registered successfully",
        did: did_string,
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
      };
    }
  }

  /**
   * Check if DID exists
   */
  async checkDID(did: string) {
    const exists = await BlockchainService.isDIDRegistered(did);

    if (!exists) {
      throw new NotFoundError("DID not found");
    }

    return {
      message: "DID exists",
      did,
      exists: true,
    };
  }

  /**
   * Get number of blocks on blockchain
   */
  async getBlockCount() {
    const blockNumber = await BlockchainService.getBlockNumber();

    return {
      message: "Number of blocks retrieved",
      blockCount: blockNumber,
    };
  }

  /**
   * Rotate DID key
   */
  async rotateKey(did: string, newPublicKey: string) {
    // Check if DID exists
    const exists = await BlockchainService.isDIDRegistered(did);
    if (!exists) {
      throw new NotFoundError("DID not found");
    }

    // Rotate key
    const receipt = await BlockchainService.registerNewKey(did, newPublicKey);

    return {
      message: "DID key rotated successfully",
      did,
      transactionHash: receipt.hash,
      blockNumber: receipt.blockNumber,
    };
  }

  /**
   * Deactivate DID
   */
  async deactivateDID(did: string) {
    // Check if DID exists
    const exists = await BlockchainService.isDIDRegistered(did);
    if (!exists) {
      throw new NotFoundError("DID not found");
    }

    // Deactivate DID
    const receipt = await BlockchainService.deactivateDID(did);

    // TODO: Trigger batch revocation for all associated VCs via message queue

    return {
      message: "DID deactivated successfully",
      did,
      transactionHash: receipt.hash,
      blockNumber: receipt.blockNumber,
    };
  }

  /**
   * Get DID Document
   */
  async getDIDDocument(did: string) {
    const document = await BlockchainService.getDIDDocument(did);

    return {
      message: "DID document retrieved successfully",
      did_document: document,
    };
  }
}

export default new DIDService();
