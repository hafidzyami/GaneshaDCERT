import { BadRequestError, NotFoundError } from "../utils/errors/AppError";
import logger from "../config/logger";
import BlockchainService from "./blockchain/vcBlockchain.service";
import { prisma } from "../config/database";
import { TransactionReceipt } from "ethers";
import { VCSchema, Prisma } from "@prisma/client";
import { JsonValue } from "@prisma/client/runtime/library";

/**
 * Schema Service with Database + Blockchain Integration
 *
 * STRATEGY:
 * - POST/PUT/DELETE: Write to both Database + Blockchain
 * - GET: Read from Database only (faster, no blockchain calls)
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

  // ============================================
  // 🔹 GETTER METHODS (Database Only)
  // ============================================

  /**
   * Get all VC Schemas from database with optional filters
   * @param issuerDid - Optional filter by issuer DID
   * @param activeOnly - Optional filter to show only active schemas
   */
  async getAllVCSchemas(
    issuerDid?: string,
    activeOnly: boolean = false
  ): Promise<VCSchema[]> {
    try {
      logger.info("Fetching VC Schemas from database...");

      const whereClause: Prisma.VCSchemaWhereInput = {};

      // Filter by issuerDid if provided
      if (issuerDid) {
        whereClause.issuer_did = issuerDid;
      }

      // Filter active only if requested
      if (activeOnly) {
        whereClause.isActive = true;
      }

      const schemas = await prisma.vCSchema.findMany({
        where: whereClause,
        orderBy: [{ issuer_did: "asc" }, { name: "asc" }, { version: "desc" }],
      });

      logger.info(`Retrieved ${schemas.length} schema(s) from database`);
      return schemas;
    } catch (error: any) {
      logger.error("Failed to fetch VC schemas:", error);
      throw error;
    }
  }

  /**
   * Get schema by ID from database
   */
  async getSchemaById(id: string): Promise<VCSchema> {
    try {
      logger.info(`Fetching schema by ID: ${id}`);

      const schema = await prisma.vCSchema.findUnique({
        where: { id },
      });

      if (!schema) {
        throw new NotFoundError(`Schema with ID ${id} not found`);
      }

      logger.info(`Retrieved schema: ${id}`);
      return schema;
    } catch (error: any) {
      logger.error("Failed to get schema by ID:", error);
      throw error;
    }
  }

  /**
   * Get latest version of a schema by name and issuer
   */
  async getLatestSchemaVersion(
    name: string,
    issuerDid: string
  ): Promise<VCSchema> {
    try {
      logger.info(`Fetching latest version of schema: ${name} by ${issuerDid}`);

      const schema = await prisma.vCSchema.findFirst({
        where: {
          name,
          issuer_did: issuerDid,
        },
        orderBy: {
          version: "desc",
        },
      });

      if (!schema) {
        throw new NotFoundError(
          `Schema "${name}" not found for issuer ${issuerDid}`
        );
      }

      logger.info(
        `Latest version of ${name}: v${schema.version} (ID: ${schema.id})`
      );
      return schema;
    } catch (error: any) {
      logger.error("Failed to get latest schema version:", error);
      throw error;
    }
  }

  /**
   * Get all versions of a specific schema by name and issuer
   */
  async getAllSchemaVersions(
    name: string,
    issuerDid: string
  ): Promise<VCSchema[]> {
    try {
      logger.info(`Fetching all versions of schema: ${name}`);

      const schemas = await prisma.vCSchema.findMany({
        where: {
          name,
          issuer_did: issuerDid,
        },
        orderBy: {
          version: "asc",
        },
      });

      logger.info(`Found ${schemas.length} version(s) of schema ${name}`);
      return schemas;
    } catch (error: any) {
      logger.error("Failed to get all schema versions:", error);
      throw error;
    }
  }

  /**
   * Check if a specific schema is active
   */
  async isSchemaActive(id: string): Promise<boolean> {
    try {
      const schema = await this.getSchemaById(id);
      return schema.isActive;
    } catch (error: any) {
      logger.error("Failed to check schema status:", error);
      throw error;
    }
  }

  // ============================================
  // 🔹 POST/PUT/DELETE METHODS (Database + Blockchain)
  // ============================================

  /**
   * Create a new VC Schema (Database + Blockchain)
   */
  async createVCSchema(data: {
    name: string;
    schema: Prisma.JsonValue;
    issuer_did: string;
  }): Promise<{
    message: string;
    schema: VCSchema;
    transaction_hash: string;
  }> {
    try {
      logger.info("Creating VC Schema on database + blockchain...");
      logger.info(`Name: ${data.name}`);
      logger.info(`Issuer: ${data.issuer_did}`);

      // 1. Create in database first
      const newSchema = await prisma.vCSchema.create({
        data: {
          name: data.name,
          schema: data.schema as Prisma.InputJsonValue,
          issuer_did: data.issuer_did,
          version: 1,
          isActive: true,
        },
      });

      logger.info(`✅ Schema created in database: ${newSchema.id} v1`);

      // 2. Then create in blockchain
      try {
        const schemaString = JSON.stringify(data.schema);

        const receipt: TransactionReceipt =
          await this.blockchainService.createVCSchemaInBlockchain(
            newSchema.id,
            data.name,
            schemaString,
            data.issuer_did
          );

        logger.info(
          `✅ Schema created in blockchain: ${newSchema.id} (TX: ${receipt.hash})`
        );

        return {
          message: "VC Schema created successfully in database and blockchain",
          schema: newSchema,
          transaction_hash: receipt.hash,
        };
      } catch (blockchainError: any) {
        // Rollback: Delete from database if blockchain fails
        logger.error("Blockchain creation failed, rolling back database...");
        await prisma.vCSchema.delete({
          where: { id: newSchema.id },
        });

        throw new BadRequestError(
          `Blockchain creation failed: ${blockchainError.message}`
        );
      }
    } catch (error: any) {
      logger.error("Failed to create VC schema:", error);
      throw error;
    }
  }

  /**
   * Update an existing VC Schema (Database + Blockchain)
   * Creates a new version in both systems
   */
  async updateVCSchema(
    id: string,
    data: {
      schema: Prisma.JsonValue;
    }
  ): Promise<{
    message: string;
    schema: VCSchema;
    transaction_hash: string;
  }> {
    try {
      logger.info(`Updating VC Schema: ${id}`);

      // 1. Get existing schema
      const existingSchema = await this.getSchemaById(id);

      // 2. Create new version in database
      const newVersion = existingSchema.version + 1;
      const updatedSchema = await prisma.vCSchema.create({
        data: {
          name: existingSchema.name,
          schema: data.schema as Prisma.InputJsonValue,
          issuer_did: existingSchema.issuer_did,
          version: newVersion,
          isActive: true,
        },
      });

      logger.info(
        `✅ Schema updated in database: ${updatedSchema.id} v${newVersion}`
      );

      // 3. Update in blockchain (creates new version)
      try {
        const schemaString = JSON.stringify(data.schema);

        const receipt: TransactionReceipt =
          await this.blockchainService.updateVCSchemaInBlockchain(
            existingSchema.id, // Use original schema ID
            schemaString
          );

        logger.info(
          `✅ Schema updated in blockchain: ${existingSchema.id} v${newVersion} (TX: ${receipt.hash})`
        );

        return {
          message: "VC Schema updated successfully in database and blockchain",
          schema: updatedSchema,
          transaction_hash: receipt.hash,
        };
      } catch (blockchainError: any) {
        // Rollback: Delete new version from database if blockchain fails
        logger.error("Blockchain update failed, rolling back database...");
        await prisma.vCSchema.delete({
          where: { id: updatedSchema.id },
        });

        throw new BadRequestError(
          `Blockchain update failed: ${blockchainError.message}`
        );
      }
    } catch (error: any) {
      logger.error("Failed to update VC schema:", error);
      throw error;
    }
  }

  /**
   * Deactivate a VC Schema (Database + Blockchain)
   */
  async deactivateVCSchema(id: string): Promise<{
    message: string;
    schema: VCSchema;
    transaction_hash: string;
  }> {
    try {
      logger.info(`Deactivating VC Schema: ${id}`);

      // 1. Get schema to deactivate
      const schema = await this.getSchemaById(id);

      if (!schema.isActive) {
        throw new BadRequestError("Schema is already deactivated");
      }

      // 2. Deactivate in database
      const deactivatedSchema = await prisma.vCSchema.update({
        where: { id },
        data: { isActive: false },
      });

      logger.info(`✅ Schema deactivated in database: ${id}`);

      // 3. Deactivate in blockchain
      try {
        const receipt: TransactionReceipt =
          await this.blockchainService.deactivateVCSchemaInBlockchain(
            schema.id,
            schema.version
          );

        logger.info(
          `✅ Schema deactivated in blockchain: ${id} v${schema.version} (TX: ${receipt.hash})`
        );

        return {
          message: "VC Schema deactivated successfully",
          schema: deactivatedSchema,
          transaction_hash: receipt.hash,
        };
      } catch (blockchainError: any) {
        // Rollback: Reactivate in database if blockchain fails
        logger.error(
          "Blockchain deactivation failed, rolling back database..."
        );
        await prisma.vCSchema.update({
          where: { id },
          data: { isActive: true },
        });

        throw new BadRequestError(
          `Blockchain deactivation failed: ${blockchainError.message}`
        );
      }
    } catch (error: any) {
      logger.error("Failed to deactivate VC schema:", error);
      throw error;
    }
  }

  /**
   * Reactivate a VC Schema (Database + Blockchain)
   */
  async reactivateVCSchema(id: string): Promise<{
    message: string;
    schema: VCSchema;
    transaction_hash: string;
  }> {
    try {
      logger.info(`Reactivating VC Schema: ${id}`);

      // 1. Get schema to reactivate
      const schema = await this.getSchemaById(id);

      if (schema.isActive) {
        throw new BadRequestError("Schema is already active");
      }

      // 2. Reactivate in database
      const reactivatedSchema = await prisma.vCSchema.update({
        where: { id },
        data: { isActive: true },
      });

      logger.info(`✅ Schema reactivated in database: ${id}`);

      // 3. Reactivate in blockchain
      try {
        const receipt: TransactionReceipt =
          await this.blockchainService.reactivateVCSchemaInBlockchain(
            schema.id,
            schema.version
          );

        logger.info(
          `✅ Schema reactivated in blockchain: ${id} v${schema.version} (TX: ${receipt.hash})`
        );

        return {
          message: "VC Schema reactivated successfully",
          schema: reactivatedSchema,
          transaction_hash: receipt.hash,
        };
      } catch (blockchainError: any) {
        // Rollback: Deactivate in database if blockchain fails
        logger.error(
          "Blockchain reactivation failed, rolling back database..."
        );
        await prisma.vCSchema.update({
          where: { id },
          data: { isActive: false },
        });

        throw new BadRequestError(
          `Blockchain reactivation failed: ${blockchainError.message}`
        );
      }
    } catch (error: any) {
      logger.error("Failed to reactivate VC schema:", error);
      throw error;
    }
  }

  /**
   * Delete a VC Schema (Soft delete - deactivate only)
   * Note: We don't actually delete from blockchain, just deactivate
   */
  async deleteVCSchema(id: string): Promise<{
    message: string;
    transaction_hash?: string;
  }> {
    try {
      logger.info(`Deleting (deactivating) VC Schema: ${id}`);

      // Use deactivate instead of hard delete
      const result = await this.deactivateVCSchema(id);

      return {
        message: "VC Schema deleted (deactivated) successfully",
        transaction_hash: result.transaction_hash,
      };
    } catch (error: any) {
      logger.error("Failed to delete VC schema:", error);
      throw error;
    }
  }
}

// Export singleton instance for backward compatibility
export default new SchemaService();

// Export class for testing and custom instantiation
export { SchemaService };
