import { ethers, TransactionReceipt } from "ethers";
import DIDBlockchainConfig from "../../config/didblockchain";
import { BlockchainError, NotFoundError } from "../../utils/errors/AppError";
import logger from "../../config/logger";
import {
  DIDDocument,
  DIDDocumentMetadata,
  DIDResolutionResult,
  VerificationMethod,
  ServiceEndpoint,
  DID_CONTEXT,
} from "../../types";

/**
 * Blockchain Service with Dependency Injection
 * Handles all blockchain interactions with proper error handling
 */
class DIDBlockchainService {
  private contract: ethers.Contract;

  /**
   * Constructor with dependency injection
   * @param dependencies - Optional dependencies for testing
   */
  constructor(dependencies?: { contract?: ethers.Contract }) {
    this.contract = dependencies?.contract || DIDBlockchainConfig.contract;
  }

  /**
   * Register Individual DID on Blockchain
   */
  async registerIndividualDID(
    did: string,
    publicKey: string
  ): Promise<TransactionReceipt> {
    try {
      const tx = await this.contract.registerIndividual(
        did,
        "#key-1",
        publicKey
      );
      const receipt = await tx.wait();

      if (receipt.status !== 1) {
        throw new BlockchainError(
          "Transaction failed on blockchain",
          receipt.hash
        );
      }

      logger.success(`Individual DID registered: ${did} (TX: ${receipt.hash})`);
      return receipt;
    } catch (error: any) {
      logger.error("Failed to register individual DID:", error);

      if (error instanceof BlockchainError) {
        throw error;
      }

      throw new BlockchainError(
        `Failed to register individual DID: ${error.message}`
      );
    }
  }

  /**
   * Register Institutional DID on Blockchain
   */
  async registerInstitutionalDID(
    did: string,
    publicKey: string,
    email: string,
    name: string,
    phone: string,
    country: string,
    website: string,
    address: string
  ): Promise<TransactionReceipt> {
    try {
      const tx = await this.contract.registerInstitution(
        did,
        "#key-1",
        publicKey,
        email,
        name,
        phone,
        country,
        website,
        address
      );

      const receipt = await tx.wait();

      if (receipt.status !== 1) {
        throw new BlockchainError(
          "Transaction failed on blockchain",
          receipt.hash
        );
      }

      logger.success(
        `Institutional DID registered: ${did} (TX: ${receipt.hash})`
      );
      return receipt;
    } catch (error: any) {
      logger.error("Failed to register institutional DID:", error);

      if (error instanceof BlockchainError) {
        throw error;
      }

      throw new BlockchainError(
        `Failed to register institutional DID: ${error.message}`
      );
    }
  }

  /**
   * Register New Key for DID Rotation
   */
  async registerNewKey(
    did: string,
    newPublicKey: string
  ): Promise<TransactionReceipt> {
    try {
      const currentKeyId = await this.contract.getActiveKeyId(did);
      const keyNumber = parseInt(currentKeyId.split("-").pop() || "1", 10);
      const newKeyId = `#key-${keyNumber + 1}`;

      const tx = await this.contract.registerNewKey(
        did,
        newKeyId,
        newPublicKey
      );
      const receipt = await tx.wait();

      if (receipt.status !== 1) {
        throw new BlockchainError(
          "Key rotation transaction failed",
          receipt.hash
        );
      }

      logger.success(`Key rotated for DID: ${did} (New KeyID: ${newKeyId})`);
      return receipt;
    } catch (error: any) {
      logger.error("Failed to rotate key:", error);

      if (error instanceof BlockchainError) {
        throw error;
      }

      throw new BlockchainError(`Failed to rotate key: ${error.message}`);
    }
  }

  /**
   * Check if DID exists on Blockchain
   */
  async isDIDRegistered(did: string): Promise<boolean> {
    try {
      return await this.contract.isRegistered(did);
    } catch (error: any) {
      logger.error("Failed to check DID:", error);
      throw new BlockchainError(`Failed to check DID: ${error.message}`);
    }
  }

  /**
   * Get DID Public Key
   */
  async getDIDKey(did: string, keyId?: string): Promise<string> {
    try {
      const key = keyId
        ? await this.contract.getKey(did, keyId)
        : await this.contract.getKey(did);

      return key;
    } catch (error: any) {
      logger.error("Failed to get DID key:", error);
      throw new BlockchainError(`Failed to get DID key: ${error.message}`);
    }
  }

  /**
   * Get Total DID Count
   */
  async getDIDCount(): Promise<bigint> {
    try {
      return await this.contract.getDIDCount();
    } catch (error: any) {
      logger.error("Failed to get DID count:", error);
      throw new BlockchainError(`Failed to get DID count: ${error.message}`);
    }
  }

  /**
   * Get Current Block Number
   */
  async getBlockNumber(): Promise<number> {
    try {
      return await DIDBlockchainConfig.provider.getBlockNumber();
    } catch (error: any) {
      logger.error("Failed to get block number:", error);
      throw new BlockchainError(`Failed to get block number: ${error.message}`);
    }
  }

  /**
   * Deactivate DID
   */
  async deactivateDID(did: string): Promise<TransactionReceipt> {
    try {
      const tx = await this.contract.deactivate(did);
      const receipt = await tx.wait();

      if (receipt.status !== 1) {
        throw new BlockchainError(
          "DID deactivation transaction failed",
          receipt.hash
        );
      }

      logger.success(`DID deactivated: ${did} (TX: ${receipt.hash})`);
      return receipt;
    } catch (error: any) {
      logger.error("Failed to deactivate DID:", error);

      if (error instanceof BlockchainError) {
        throw error;
      }

      throw new BlockchainError(`Failed to deactivate DID: ${error.message}`);
    }
  }

  /**
   * Get DID Document (Legacy Format)
   * Returns object with found status instead of throwing NotFoundError
   * @deprecated Use getDIDDocumentW3C for W3C-compliant format
   */
  async getDIDDocumentLegacy(did: string): Promise<any> {
    try {
      const isRegistered = await this.isDIDRegistered(did);

      if (!isRegistered) {
        logger.warn(`DID not found on blockchain: ${did}`);
        return {
          found: false,
          error: "Not Found",
          message: "DID not found on blockchain",
          did: did,
        };
      }

      const document = await this.contract.getDIDDocument(did);
      const keyId = await this.contract.getActiveKeyId(did);
      const publicKey = await this.getDIDKey(did, keyId);

      let institutionalDetails: any[] = [];
      const jsonDetails: any = {};
      if (document[1] == 2) {
        institutionalDetails = await this.contract.getInstitutionDetails(did);
        if (institutionalDetails && institutionalDetails.length > 1) {
          jsonDetails["email"] = institutionalDetails[1];
          jsonDetails["name"] = institutionalDetails[2];
          jsonDetails["phone"] = institutionalDetails[3];
          jsonDetails["country"] = institutionalDetails[4];
          jsonDetails["website"] = institutionalDetails[5];
          jsonDetails["address"] = institutionalDetails[6];
        }
      }

      return {
        found: true,
        id: did,
        status: document[0] == 1 ? "InActive" : "Active",
        role: document[1] == 1 ? "Individual" : "Institutional",
        keyId: keyId,
        [keyId]: publicKey,
        details: jsonDetails,
      };
    } catch (error: any) {
      logger.error("Failed to get DID document:", error);
      throw new BlockchainError(`Failed to get DID document: ${error.message}`);
    }
  }

  /**
   * Get DID Document (W3C Compliant Format)
   * Returns W3C DID Core Specification compliant DID Document
   * https://www.w3.org/TR/did-core/
   */
  async getDIDDocument(did: string): Promise<DIDResolutionResult> {
    try {
      const isRegistered = await this.isDIDRegistered(did);
      const retrievedAt = new Date().toISOString();

      if (!isRegistered) {
        logger.warn(`DID not found on blockchain: ${did}`);
        return {
          didDocument: null,
          didDocumentMetadata: {
            deactivated: false,
          },
          didResolutionMetadata: {
            error: "notFound",
            retrieved: retrievedAt,
          },
        };
      }

      const document = await this.contract.getDIDDocument(did);
      const keyId = await this.contract.getActiveKeyId(did);
      const publicKey = await this.getDIDKey(did, keyId);

      // Determine status and role
      const isDeactivated = document[0] == 1;
      const isInstitutional = document[1] == 2;

      // Build verification method ID
      const verificationMethodId = `${did}${keyId}`;

      // Build verification method
      const verificationMethod: VerificationMethod = {
        id: verificationMethodId,
        type: "EcdsaSecp256k1VerificationKey2019",
        controller: did,
        publicKeyHex: publicKey,
      };

      // Build base DID Document
      const didDocument: DIDDocument = {
        "@context": [
          DID_CONTEXT.W3C_DID_V1_1,
          DID_CONTEXT.SECP256K1_2019,
        ],
        id: did,
        controller: did,
        verificationMethod: [verificationMethod],
        authentication: [verificationMethodId],
        assertionMethod: [verificationMethodId],
      };

      // Add institutional details as service endpoints if available
      if (isInstitutional) {
        const institutionalDetails = await this.contract.getInstitutionDetails(did);
        if (institutionalDetails && institutionalDetails.length > 1) {
          const services: ServiceEndpoint[] = [];

          // Add institution profile service
          services.push({
            id: `${did}#institution-profile`,
            type: "InstitutionProfile",
            serviceEndpoint: {
              name: institutionalDetails[2],
              email: institutionalDetails[1],
              phone: institutionalDetails[3],
              country: institutionalDetails[4],
              website: institutionalDetails[5],
              address: institutionalDetails[6],
            },
          });

          // Add website as LinkedDomains service if available
          if (institutionalDetails[5]) {
            services.push({
              id: `${did}#linked-domain`,
              type: "LinkedDomains",
              serviceEndpoint: institutionalDetails[5],
            });
          }

          didDocument.service = services;
        }
      }

      // Build metadata
      const didDocumentMetadata: DIDDocumentMetadata = {
        deactivated: isDeactivated,
      };

      return {
        didDocument,
        didDocumentMetadata,
        didResolutionMetadata: {
          contentType: "application/did+ld+json",
          retrieved: retrievedAt,
        },
      };
    } catch (error: any) {
      logger.error("Failed to get DID document:", error);
      throw new BlockchainError(`Failed to get DID document: ${error.message}`);
    }
  }
}

// Export singleton instance for backward compatibility
export default new DIDBlockchainService();

// Export class for testing and custom instantiation
export { DIDBlockchainService };
