import { ethers, TransactionReceipt } from "ethers";
import VCBlockchainConfig from "../../config/vcblockchain";
import { BlockchainError, NotFoundError } from "../../utils/errors/AppError";

/**
 * VC Blockchain Service
 * Handles all VC blockchain interactions with proper error handling
 */
class VCBlockchainService {
  private contract: ethers.Contract;

  constructor() {
    this.contract = VCBlockchainConfig.contract;
  }

  /**
   * Created VC Schema on Blockchain
   */
  async createVCSchemaInBlockchain(
    id: string,
    name: string,
    schema: string,
    issuerDID: string
  ): Promise<TransactionReceipt> {
    try {
      const tx = await this.contract.createVCSchema(
        id,
        name,
        schema,
        issuerDID
      );
      const receipt = await tx.wait();

      if (receipt.status !== 1) {
        throw new BlockchainError(
          "Transaction failed on blockchain",
          receipt.hash
        );
      }

      console.log(`✅ VC Schema created: ${id} (TX: ${receipt.hash})`);
      return receipt;
    } catch (error: any) {
      console.error("❌ Failed to create VC Schema:", error);

      if (error instanceof BlockchainError) {
        throw error;
      }

      throw new BlockchainError(`Failed to create VC Schema: ${error.message}`);
    }
  }

  /**
   * Update VC Schema on Blockchain
   */
  async updateVCSchemaInBlockchain(
    id: string,
    newSchema: string
  ): Promise<TransactionReceipt> {
    try {
      const tx = await this.contract.updateVCSchema(id, newSchema);

      const receipt = await tx.wait();

      if (receipt.status !== 1) {
        throw new BlockchainError(
          "Transaction failed on blockchain",
          receipt.hash
        );
      }

      console.log(`✅ VC Schema updated: ${id} (TX: ${receipt.hash})`);
      return receipt;
    } catch (error: any) {
      console.error("❌ Failed to update VC Schema:", error);

      if (error instanceof BlockchainError) {
        throw error;
      }

      throw new BlockchainError(`Failed to update VC Schema: ${error.message}`);
    }
  }

  /**
   * Deactivate Existing VC Schema in Blockchain
   */
  async deActivateVCSchemaInBlockchain(
    id: string
  ): Promise<TransactionReceipt> {
    try {
      const tx = await this.contract.deactivateVCSchema(id);
      const receipt = await tx.wait();

      if (receipt.status !== 1) {
        throw new BlockchainError(
          "Deactivate transaction failed",
          receipt.hash
        );
      }

      console.log(`✅ Deactivated VC Schema for UUID: ${id}`);
      return receipt;
    } catch (error: any) {
      console.error("❌ Failed to deactivate VC Schema:", error);

      if (error instanceof BlockchainError) {
        throw error;
      }

      throw new BlockchainError(
        `Failed to deactivate VC Schema: ${error.message}`
      );
    }
  }

  /**
   * Reactivate Existing VC Schema in Blockchain
   */
  async reActivateVCSchemaInBlockchain(id: string): Promise<boolean> {
    try {
      const tx = await this.contract.reactivateVCSchema(id);
      const receipt = await tx.wait();

      if (receipt.status !== 1) {
        throw new BlockchainError(
          "Reactivate transaction failed",
          receipt.hash
        );
      }

      console.log(`✅ Reactivated VC Schema for UUID: ${id}`);
      return receipt;
    } catch (error: any) {
      console.error("❌ Failed to reactivate VC Schema:", error);

      if (error instanceof BlockchainError) {
        throw error;
      }

      throw new BlockchainError(
        `Failed to reactivate VC Schema: ${error.message}`
      );
    }
  }

  /**
   * Get All VC Schemas from Blockchain
   */
  async getAllVCSchemasFromBlockchain(): Promise<any[]> {
    try {
      const schemas = await this.contract.getAllVCSchemas();

      console.log(`✅ Retrieved ${schemas.length} VC Schemas from blockchain`);
      return schemas;
    } catch (error: any) {
      console.error("❌ Failed to get VC Schemas:", error);
      throw new BlockchainError(`Failed to get VC Schemas: ${error.message}`);
    }
  }

  /**
   * Issue VC on Blockchain
   */
  async issueVCInBlockchain(
    id: string,
    issuerDID: string,
    holderDID: string,
    vcType: string,
    schemaID: string,
    hash: string
  ): Promise<TransactionReceipt> {
    try {
      const tx = await this.contract.issueVC(
        id,
        issuerDID,
        holderDID,
        vcType,
        schemaID,
        hash
      );
      const receipt = await tx.wait();

      if (receipt.status !== 1) {
        throw new BlockchainError(
          "Transaction failed on blockchain",
          receipt.hash
        );
      }

      console.log(`✅ VC issued: ${id} (TX: ${receipt.hash})`);
      return receipt;
    } catch (error: any) {
      console.error("❌ Failed to issue VC:", error);

      if (error instanceof BlockchainError) {
        throw error;
      }

      throw new BlockchainError(`Failed to issue VC: ${error.message}`);
    }
  }

  /**
   * Renew VC on Blockchain
   */
  async renewVCInBlockchain(id: string): Promise<TransactionReceipt> {
    try {
      const tx = await this.contract.renewVC(id);
      const receipt = await tx.wait();

      if (receipt.status !== 1) {
        throw new BlockchainError("Renew transaction failed", receipt.hash);
      }

      console.log(`✅ VC renewed: ${id} (TX: ${receipt.hash})`);
      return receipt;
    } catch (error: any) {
      console.error("❌ Failed to renew VC:", error);

      if (error instanceof BlockchainError) {
        throw error;
      }

      throw new BlockchainError(`Failed to renew VC: ${error.message}`);
    }
  }

  /**
   * Update VC on Blockchain
   */
  async updateVCInBlockchain(
    id: string,
    newHash: string
  ): Promise<TransactionReceipt> {
    try {
      const tx = await this.contract.updateVC(id, newHash);
      const receipt = await tx.wait();

      if (receipt.status !== 1) {
        throw new BlockchainError("Update transaction failed", receipt.hash);
      }

      console.log(`✅ VC updated: ${id} (TX: ${receipt.hash})`);
      return receipt;
    } catch (error: any) {
      console.error("❌ Failed to update VC:", error);

      if (error instanceof BlockchainError) {
        throw error;
      }

      throw new BlockchainError(`Failed to update VC: ${error.message}`);
    }
  }

  /**
   * Revoke VC on Blockchain
   */
  async revokeVCInBlockchain(id: string): Promise<TransactionReceipt> {
    try {
      const tx = await this.contract.revokeVC(id);
      const receipt = await tx.wait();

      if (receipt.status !== 1) {
        throw new BlockchainError("Revoke transaction failed", receipt.hash);
      }

      console.log(`✅ VC revoked: ${id} (TX: ${receipt.hash})`);
      return receipt;
    } catch (error: any) {
      console.error("❌ Failed to revoke VC:", error);

      if (error instanceof BlockchainError) {
        throw error;
      }

      throw new BlockchainError(`Failed to revoke VC: ${error.message}`);
    }
  }

  /**
   * Verify VC on Blockchain
   */
  async verifyVCInBlockchain(id: string, hash: string): Promise<boolean> {
    try {
      const isValid = await this.contract.verifyVC(id, hash);

      console.log(`✅ VC verification result for ${id}: ${isValid}`);
      return isValid;
    } catch (error: any) {
      console.error("❌ Failed to verify VC:", error);
      throw new BlockchainError(`Failed to verify VC: ${error.message}`);
    }
  }

  /**
   * Get VCs by Issuer DID from Blockchain
   */
  async getVCsByIssuerDID(issuerDID: string): Promise<any[]> {
    try {
      const vcs = await this.contract.getVCByIssuerDID(issuerDID);

      console.log(`✅ Retrieved ${vcs.length} VCs for issuer: ${issuerDID}`);
      return vcs;
    } catch (error: any) {
      console.error("❌ Failed to get VCs by issuer DID:", error);
      throw new BlockchainError(
        `Failed to get VCs by issuer DID: ${error.message}`
      );
    }
  }

  /**
   * Get VCs by Holder DID from Blockchain
   */
  async getVCsByHolderDID(holderDID: string): Promise<any[]> {
    try {
      const vcs = await this.contract.getVCByHolderDID(holderDID);

      console.log(`✅ Retrieved ${vcs.length} VCs for holder: ${holderDID}`);
      return vcs;
    } catch (error: any) {
      console.error("❌ Failed to get VCs by holder DID:", error);
      throw new BlockchainError(
        `Failed to get VCs by holder DID: ${error.message}`
      );
    }
  }
}

export default new VCBlockchainService();
