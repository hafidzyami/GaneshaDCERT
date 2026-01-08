import { ethers, TransactionReceipt } from "ethers";
import VCBlockchainConfig from "../../config/vcblockchain";
import { BlockchainError, NotFoundError } from "../../utils/errors/AppError";

/**
 * VC Blockchain Service
 * Handles all VC blockchain interactions with proper error handling
 * Updated to support Schema Versioning
 */
class VCBlockchainService {
  private contract: ethers.Contract;

  /**
   * Constructor with dependency injection
   * @param dependencies - Optional dependencies for testing
   */
  constructor(dependencies?: { contract?: ethers.Contract }) {
    this.contract = dependencies?.contract || VCBlockchainConfig.contract;
  }

  // ============================================
  // 🔹 VC SCHEMA MANAGEMENT
  // ============================================

  /**
   * Create VC Schema on Blockchain
   * Creates version 1 of a new schema
   */
  async createVCSchemaInBlockchain(
    id: string,
    name: string,
    schema: string,
    issuerDID: string,
    imageLink: string = ""
  ): Promise<TransactionReceipt> {
    try {
      // Convert all parameters to string to ensure proper type
      const idString = String(id);
      const nameString = String(name);
      const schemaString = String(schema);
      const issuerDIDString = String(issuerDID);
      const imageLinkString = String(imageLink);

      console.log("🔍 [VCBlockchainService] createVCSchemaInBlockchain called with:", {
        id: idString,
        id_type: typeof idString,
        id_length: idString.length,
        name: nameString,
        issuerDID: issuerDIDString,
        issuerDID_type: typeof issuerDIDString,
        issuerDID_length: issuerDIDString.length,
        imageLink: imageLinkString,
        schemaLength: schemaString.length
      });

      const tx = await this.contract.createVCSchema(
        idString,
        nameString,
        schemaString,
        issuerDIDString,
        imageLinkString
      );
      const receipt = await tx.wait();

      if (receipt.status !== 1) {
        throw new BlockchainError(
          "Transaction failed on blockchain",
          receipt.hash
        );
      }

      console.log(`✅ VC Schema created: ${idString} v1 (TX: ${receipt.hash})`);
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
   * Creates a new version of existing schema
   */
  async updateVCSchemaInBlockchain(
    id: string,
    newSchema: string,
    imageLink: string = ""
  ): Promise<TransactionReceipt> {
    try {
      // Convert all parameters to string to ensure proper type
      const idString = String(id);
      const newSchemaString = String(newSchema);
      const imageLinkString = String(imageLink);

      console.log("🔍 [VCBlockchainService] updateVCSchemaInBlockchain called with:", {
        id: idString,
        id_type: typeof idString,
        id_length: idString.length,
        imageLink: imageLinkString,
        schemaLength: newSchemaString.length
      });

      const tx = await this.contract.updateVCSchema(idString, newSchemaString, imageLinkString);
      const receipt = await tx.wait();

      if (receipt.status !== 1) {
        throw new BlockchainError(
          "Transaction failed on blockchain",
          receipt.hash
        );
      }

      console.log(`✅ VC Schema updated: ${idString} (new version) (TX: ${receipt.hash})`);
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
   * Deactivate Existing VC Schema Version in Blockchain
   */
  async deactivateVCSchemaInBlockchain(
    id: string,
    version: number
  ): Promise<TransactionReceipt> {
    try {
      const tx = await this.contract.deactivateVCSchema(id, version);
      const receipt = await tx.wait();

      if (receipt.status !== 1) {
        throw new BlockchainError(
          "Deactivate transaction failed",
          receipt.hash
        );
      }

      console.log(`✅ Deactivated VC Schema: ${id} v${version} (TX: ${receipt.hash})`);
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
   * Reactivate Existing VC Schema Version in Blockchain
   */
  async reactivateVCSchemaInBlockchain(
    id: string,
    version: number
  ): Promise<TransactionReceipt> {
    try {
      const tx = await this.contract.reactivateVCSchema(id, version);
      const receipt = await tx.wait();

      if (receipt.status !== 1) {
        throw new BlockchainError(
          "Reactivate transaction failed",
          receipt.hash
        );
      }

      console.log(`✅ Reactivated VC Schema: ${id} v${version} (TX: ${receipt.hash})`);
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
   * Get All VC Schemas from Blockchain with pagination (latest versions only by default)
   * @param page - Page number (starts from 1)
   * @param limit - Number of items per page (default: 100, max: 1000)
   * @param latestOnly - Return only latest versions (default: true)
   * @returns Object containing schemas array and pagination metadata
   */
  async getAllSchemasFromBlockchain(
    page: number = 1,
    limit: number = 100,
    latestOnly: boolean = true
  ): Promise<{
    schemas: any[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      returned: number;
      totalPages: number;
      hasNextPage: boolean;
      hasPrevPage: boolean;
    };
  }> {
    try {
      // Validate parameters
      const validatedPage = Math.max(1, page);
      const validatedLimit = Math.min(Math.max(1, limit), 1000);
      const offset = (validatedPage - 1) * validatedLimit;

      // First check if there are any schemas to avoid "Offset exceeds total" error
      const totalCount = latestOnly
        ? await this.contract.vcSchemas.length
        : await this.contract.getSchemasCount();
      const totalNum = Number(totalCount);

      // If no schemas exist, return empty result
      if (totalNum === 0) {
        console.log(`✅ No VC Schemas found in blockchain`);
        return {
          schemas: [],
          pagination: {
            page: validatedPage,
            limit: validatedLimit,
            total: 0,
            returned: 0,
            totalPages: 0,
            hasNextPage: false,
            hasPrevPage: false,
          },
        };
      }

      // Call appropriate smart contract function
      let result;
      if (latestOnly) {
        result = await this.contract.getLatestSchemasPaginated(offset, validatedLimit);
      } else {
        result = await this.contract.getAllSchemasPaginated(offset, validatedLimit);
      }

      // Destructure result from smart contract
      const [schemasData, total, returned] = result;

      // Convert BigInt to string/number for JSON serialization
      const serializedSchemas = schemasData.map((schema: any) => ({
        id: String(schema.id),
        name: String(schema.name),
        schema: String(schema.schema),
        issuerDID: String(schema.issuerDID),
        imageLink: String(schema.imageLink),
        version: Number(schema.version),
        isActive: Boolean(schema.isActive),
      }));

      const returnedNum = Number(returned);

      console.log(
        `✅ Retrieved ${returnedNum} of ${totalNum} VC Schema${latestOnly ? ' (latest only)' : ' version'}s from blockchain (page ${validatedPage})`
      );

      return {
        schemas: serializedSchemas,
        pagination: {
          page: validatedPage,
          limit: validatedLimit,
          total: totalNum,
          returned: returnedNum,
          totalPages: Math.ceil(totalNum / validatedLimit),
          hasNextPage: offset + returnedNum < totalNum,
          hasPrevPage: validatedPage > 1,
        },
      };
    } catch (error: any) {
      console.error("❌ Failed to get VC Schemas from blockchain:", error);
      throw new BlockchainError(
        `Failed to get VC Schemas: ${error.message}`
      );
    }
  }

  /**
   * Get total count of schemas from blockchain
   * @returns Total number of schema versions
   */
  async getSchemasCountFromBlockchain(): Promise<number> {
    try {
      const count = await this.contract.getSchemasCount();
      const countNum = Number(count);
      console.log(`✅ Total schemas count from blockchain: ${countNum}`);
      return countNum;
    } catch (error: any) {
      console.error("❌ Failed to get schemas count:", error);
      throw new BlockchainError(
        `Failed to get schemas count: ${error.message}`
      );
    }
  }

  /**
   * Get specific schema by ID and version from blockchain
   * @param schemaId - Schema ID
   * @param version - Schema version
   * @returns Schema data
   */
  async getSchemaFromBlockchain(
    schemaId: string,
    version: number
  ): Promise<any> {
    try {
      const schema = await this.contract.getSchema(schemaId, version);

      // Convert BigInt to string/number for JSON serialization
      const serializedSchema = {
        id: String(schema.id),
        name: String(schema.name),
        schema: String(schema.schema),
        issuerDID: String(schema.issuerDID),
        imageLink: String(schema.imageLink),
        version: Number(schema.version),
        isActive: Boolean(schema.isActive),
      };

      console.log(`✅ Retrieved schema ${schemaId} v${version} from blockchain`);
      return serializedSchema;
    } catch (error: any) {
      console.error(`❌ Failed to get schema ${schemaId} v${version}:`, error);
      throw new BlockchainError(
        `Failed to get schema: ${error.message}`
      );
    }
  }

  /**
   * Get latest version of a schema from blockchain
   * @param schemaId - Schema ID
   * @returns Latest schema data
   */
  async getLatestSchemaFromBlockchain(schemaId: string): Promise<any> {
    try {
      const schema = await this.contract.getLatestSchema(schemaId);

      // Convert BigInt to string/number for JSON serialization
      const serializedSchema = {
        id: String(schema.id),
        name: String(schema.name),
        schema: String(schema.schema),
        issuerDID: String(schema.issuerDID),
        imageLink: String(schema.imageLink),
        version: Number(schema.version),
        isActive: Boolean(schema.isActive),
      };

      console.log(`✅ Retrieved latest schema ${schemaId} from blockchain`);
      return serializedSchema;
    } catch (error: any) {
      console.error(`❌ Failed to get latest schema ${schemaId}:`, error);
      throw new BlockchainError(
        `Failed to get latest schema: ${error.message}`
      );
    }
  }

  // ============================================
  // 🔹 VC ISSUANCE & LIFECYCLE
  // ============================================

  /**
   * Issue VC on Blockchain
   */
  async issueVCInBlockchain(
    id: string,
    issuerDID: string,
    holderDID: string,
    vcType: string,
    schemaID: string,
    schemaVersion: number,
    expiredAt: string | undefined,
    hash: string
  ): Promise<TransactionReceipt> {
    try {
      const tx = await this.contract.issueVC(
        id,
        issuerDID,
        holderDID,
        vcType,
        schemaID,
        schemaVersion,
        expiredAt || "", // Use empty string if undefined
        hash
      );
      const receipt = await tx.wait();

      if (receipt.status !== 1) {
        throw new BlockchainError(
          "Transaction failed on blockchain",
          receipt.hash
        );
      }

      console.log(`✅ VC issued: ${id} using schema ${schemaID} v${schemaVersion} (TX: ${receipt.hash})`);
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
   * Reactivates VC with new expiration date and hash
   */
  async renewVCInBlockchain(id: string, expiredAt: string | undefined, hash: string): Promise<TransactionReceipt> {
    try {
      const tx = await this.contract.renewVC(id, expiredAt || "", hash);
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
   * Updates VC with new information and reactivates it
   */
  async updateVCInBlockchain(
    oldID: string,
    newID: string,
    issuerDID: string,
    holderDID: string,
    vcType: string,
    schemaID: string,
    schemaVersion: number,
    expiredAt: string | undefined,
    hash: string
  ): Promise<TransactionReceipt> {
    try {
      const tx = await this.contract.updateVC(
        oldID,
        newID,
        issuerDID,
        holderDID,
        vcType,
        schemaID,
        schemaVersion,
        expiredAt || "", // Use empty string if undefined
        hash
      );
      const receipt = await tx.wait();

      if (receipt.status !== 1) {
        throw new BlockchainError("Update transaction failed", receipt.hash);
      }

      console.log(`✅ VC updated: ${oldID} -> ${newID} (TX: ${receipt.hash})`);
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
   * Deactivates VC
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
   * Checks if VC is active and hash matches
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

  // ============================================
  // 🔹 QUERY FUNCTIONS
  // ============================================

  /**
   * Get All VCs from Blockchain
   * Note: This method may be expensive for large number of VCs
   */
  async getAllVCsFromBlockchain(): Promise<any[]> {
    try {
      const vcs = await this.contract.getAllVCs();

      console.log(`✅ Retrieved ${vcs.length} VCs from blockchain`);
      return vcs;
    } catch (error: any) {
      console.error("❌ Failed to get all VCs:", error);
      throw new BlockchainError(`Failed to get all VCs: ${error.message}`);
    }
  }

  /**
   * Get VC Status by ID from Blockchain
   */
  async getVCStatusFromBlockchain(vcId: string): Promise<any> {
    try {
      const vcStatus = await this.contract.getVCStatus(vcId);

      console.log(`✅ Retrieved VC status for: ${vcId}`);
      return vcStatus;
    } catch (error: any) {
      console.error("❌ Failed to get VC status:", error);

      if (error.message.includes("VC not found")) {
        throw new NotFoundError(`VC with ID ${vcId} not found on blockchain`);
      }

      throw new BlockchainError(`Failed to get VC status: ${error.message}`);
    }
  }
}

export default new VCBlockchainService();

// Export class for testing and custom instantiation
export { VCBlockchainService };
