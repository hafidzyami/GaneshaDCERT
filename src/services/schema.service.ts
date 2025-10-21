import { BadRequestError } from "../utils/errors/AppError";
import logger from "../config/logger";
import BlockchainService from "./blockchain/vcBlockchain.service";

/**
 * Schema Service with Dependency Injection
 * Handles VC Schema operations on blockchain
 * TODO: Implement actual blockchain integration
 */
class SchemaService {
  private blockchainService: typeof BlockchainService;
  /**
   * Constructor with dependency injection
   * @param dependencies - Optional dependencies for testing
   */
  constructor(dependencies?: { blockchainService?: typeof BlockchainService }) {
    this.blockchainService =
      dependencies?.blockchainService || BlockchainService;
  }

  /**
   * Get all VC Schemas with optional filter by issuer DID
   */
  async getAllVCSchemas(issuerDid?: string): Promise<any> {
    // TODO: Implement blockchain query to get all schemas
    logger.info("Fetching VC Schemas from blockchain...");
    const VCSchema = await this.blockchainService.getAllSchemasFromBlockchain();

    // Filter by issuerDid if provided
    if (issuerDid) {
      logger.info(`Filter by issuer: ${issuerDid}`);
      return VCSchema.filter((s) => s.issuer_did === issuerDid);
    }

    return VCSchema;
  }

  /**
   * Create a new VC Schema on blockchain
   */
  async createVCSchema(data: {
    id: string;
    name: string;
    schema: any;
    issuer_did: string;
    version: number;
  }): Promise<{ message: string; schema_id: string }> {
    // TODO: Implement blockchain transaction to store schema
    logger.info("Creating VC Schema on blockchain...");
    logger.info(`Schema ID: ${data.id}`);
    logger.info(`Name: ${data.name}`);
    logger.info(`Issuer: ${data.issuer_did}`);
    logger.info(`Version: ${data.version}`);

    // Simulate blockchain storage
    // const tx = await blockchainService.storeSchema(data);

    return {
      message: "VC Schema registered successfully",
      schema_id: data.id,
    };
  }

  /**
   * Update an existing VC Schema on blockchain
   */
  async updateVCSchema(
    schemaId: string,
    data: {
      name?: string;
      schema?: any;
      issuer_did?: string;
      version: number;
    }
  ): Promise<{ message: string; schema: any }> {
    // TODO: Implement blockchain query to check existing schema
    logger.info(`Updating VC Schema on blockchain: ${schemaId}`);

    // Placeholder: check if schema exists
    const existingSchema = {
      id: schemaId,
      version: 1,
    };

    // Validate version increment
    if (data.version <= existingSchema.version) {
      throw new BadRequestError(
        `Version must be greater than current version (${existingSchema.version})`
      );
    }

    // TODO: Implement blockchain transaction to update schema
    logger.info(`New version: ${data.version}`);

    // Simulate blockchain update
    // const tx = await blockchainService.updateSchema(schemaId, data);

    return {
      message: "VC schema updated successfully",
      schema: {
        id: schemaId,
        ...data,
        updatedAt: new Date(),
      },
    };
  }
}

// Export singleton instance for backward compatibility
export default new SchemaService();

// Export class for testing and custom instantiation
export { SchemaService };
