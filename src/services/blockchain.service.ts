import { ethers, TransactionReceipt } from "ethers";
import BlockchainConfig from "../config/blockchain";
import { BlockchainError, NotFoundError } from "../utils/errors/AppError";
import logger from "../config/logger";

/**
 * Blockchain Service with Dependency Injection
 * Handles all blockchain interactions with proper error handling
 */
class BlockchainService {
  private contract: ethers.Contract;

  /**
   * Constructor with dependency injection
   * @param dependencies - Optional dependencies for testing
   */
  constructor(dependencies?: {
    contract?: ethers.Contract;
  }) {
    this.contract = dependencies?.contract || BlockchainConfig.contract;
  }

  /**
   * Register Individual DID on Blockchain
   */
  async registerIndividualDID(
    did: string,
    publicKey: string
  ): Promise<TransactionReceipt> {
    try {
      const tx = await this.contract.registerIndividual(did, "#key-1", publicKey);
      const receipt = await tx.wait();

      if (receipt.status !== 1) {
        throw new BlockchainError(
          'Transaction failed on blockchain',
          receipt.hash
        );
      }

      logger.success(`Individual DID registered: ${did} (TX: ${receipt.hash})`);
      return receipt;
    } catch (error: any) {
      logger.error('Failed to register individual DID:', error);
      
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
          'Transaction failed on blockchain',
          receipt.hash
        );
      }

      logger.success(`Institutional DID registered: ${did} (TX: ${receipt.hash})`);
      return receipt;
    } catch (error: any) {
      logger.error('Failed to register institutional DID:', error);
      
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
  async registerNewKey(did: string, newPublicKey: string): Promise<TransactionReceipt> {
    try {
      const currentKeyId = await this.contract.getActiveKeyId(did);
      const keyNumber = parseInt(currentKeyId.split("-").pop() || "1", 10);
      const newKeyId = `#key-${keyNumber + 1}`;

      const tx = await this.contract.registerNewKey(did, newKeyId, newPublicKey);
      const receipt = await tx.wait();

      if (receipt.status !== 1) {
        throw new BlockchainError(
          'Key rotation transaction failed',
          receipt.hash
        );
      }

      logger.success(`Key rotated for DID: ${did} (New KeyID: ${newKeyId})`);
      return receipt;
    } catch (error: any) {
      logger.error('Failed to rotate key:', error);
      
      if (error instanceof BlockchainError) {
        throw error;
      }

      throw new BlockchainError(
        `Failed to rotate key: ${error.message}`
      );
    }
  }

  /**
   * Check if DID exists on Blockchain
   */
  async isDIDRegistered(did: string): Promise<boolean> {
    try {
      return await this.contract.isRegistered(did);
    } catch (error: any) {
      logger.error('Failed to check DID:', error);
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
      logger.error('Failed to get DID key:', error);
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
      logger.error('Failed to get DID count:', error);
      throw new BlockchainError(`Failed to get DID count: ${error.message}`);
    }
  }

  /**
   * Get Current Block Number
   */
  async getBlockNumber(): Promise<number> {
    try {
      return await BlockchainConfig.provider.getBlockNumber();
    } catch (error: any) {
      logger.error('Failed to get block number:', error);
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
          'DID deactivation transaction failed',
          receipt.hash
        );
      }

      logger.success(`DID deactivated: ${did} (TX: ${receipt.hash})`);
      return receipt;
    } catch (error: any) {
      logger.error('Failed to deactivate DID:', error);
      
      if (error instanceof BlockchainError) {
        throw error;
      }

      throw new BlockchainError(
        `Failed to deactivate DID: ${error.message}`
      );
    }
  }

  /**
   * Get DID Document
   */
  async getDIDDocument(did: string): Promise<any> {
    try {
      const isRegistered = await this.isDIDRegistered(did);
      
      if (!isRegistered) {
        throw new NotFoundError('DID not found on blockchain');
      }

      const document = await this.contract.getDIDDocument(did);
      const keyId = await this.contract.getActiveKeyId(did);
      const publicKey = await this.getDIDKey(did, keyId);

      return {
        ...document,
        [keyId]: publicKey,
      };
    } catch (error: any) {
      logger.error('Failed to get DID document:', error);
      
      if (error instanceof NotFoundError) {
        throw error;
      }

      throw new BlockchainError(
        `Failed to get DID document: ${error.message}`
      );
    }
  }
}

// Export singleton instance for backward compatibility
export default new BlockchainService();

// Export class for testing and custom instantiation
export { BlockchainService };
