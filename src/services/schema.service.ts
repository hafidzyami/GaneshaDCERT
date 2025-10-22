import { BadRequestError, NotFoundError } from "../utils/errors/AppError";
import logger from "../config/logger";
import VCBlockchainService from "./blockchain/vcBlockchain.service";
import { prisma } from "../config/database";
import { VCSchema, Prisma } from "@prisma/client";
import {
  CreateVCSchemaDTO,
  UpdateVCSchemaDTO,
  SchemaFilterDTO,
  SchemaByNameDTO,
  VCSchemaOperationResponseDTO,
  SchemaActiveStatusDTO,
  SchemaDeleteResponseDTO,
} from "../dtos/schema.dto";
import { SCHEMA_CONSTANTS } from "../constants/schema.constants";

/**
 * VC Schema Service
 * 
 * ARCHITECTURE STRATEGY:
 * - GET operations: Read from Database only (fast, no blockchain calls)
 * - POST/PUT/DELETE operations: Write to both Database + Blockchain (with rollback on failure)
 * 
 * PRINCIPLES:
 * - Single Responsibility: Each method does one thing well
 * - DRY: Reusable helper methods
 * - Error Handling: Consistent error patterns with rollback
 * - Transaction Safety: Database rollback on blockchain failures
 */
class SchemaService {
  private blockchainService: typeof VCBlockchainService;

  constructor(blockchainService?: typeof VCBlockchainService) {
    this.blockchainService = blockchainService || VCBlockchainService;
  }

  // ============================================
  // 🔹 PRIVATE HELPER METHODS
  // ============================================

  /**
   * Convert Prisma JsonValue to string for blockchain
   */
  private toBlockchainFormat(schema: Prisma.JsonValue): string {
    return JSON.stringify(schema);
  }

  /**
   * Log operation start
   */
  private logStart(operation: string, details: string): void {
    logger.info(`[SchemaService] ${operation}: ${details}`);
  }

  /**
   * Log operation success
   */
  private logSuccess(operation: string, details: string): void {
    logger.info(`✅ [SchemaService] ${operation} successful: ${details}`);
  }

  /**
   * Log operation error
   */
  private logError(operation: string, error: any): void {
    logger.error(`❌ [SchemaService] ${operation} failed:`, error);
  }

  /**
   * Build where clause for schema filtering
   */
  private buildWhereClause(filter: SchemaFilterDTO): Prisma.VCSchemaWhereInput {
    const where: Prisma.VCSchemaWhereInput = {};

    if (filter.issuerDid) {
      where.issuer_did = filter.issuerDid;
    }

    if (filter.activeOnly) {
      where.isActive = true;
    }

    return where;
  }

  // ============================================
  // 🔹 GETTER METHODS (Database Only)
  // ============================================

  /**
   * Get all VC schemas with optional filters
   */
  async getAllSchemas(filter: SchemaFilterDTO = {}): Promise<VCSchema[]> {
    try {
      this.logStart("Get all schemas", JSON.stringify(filter));

      const where = this.buildWhereClause(filter);

      const schemas = await prisma.vCSchema.findMany({
        where,
        orderBy: [
          { issuer_did: "asc" },
          { name: "asc" },
          { version: "desc" },
        ],
      });

      this.logSuccess("Get all schemas", `Retrieved ${schemas.length} schema(s)`);
      return schemas;
    } catch (error: any) {
      this.logError("Get all schemas", error);
      throw error;
    }
  }

  /**
   * Get schema by ID
   */
  async getSchemaById(id: string): Promise<VCSchema> {
    try {
      this.logStart("Get schema by ID", id);

      const schema = await prisma.vCSchema.findUnique({
        where: { id },
      });

      if (!schema) {
        throw new NotFoundError(`${SCHEMA_CONSTANTS.MESSAGES.NOT_FOUND}: ${id}`);
      }

      this.logSuccess("Get schema by ID", id);
      return schema;
    } catch (error: any) {
      this.logError("Get schema by ID", error);
      throw error;
    }
  }

  /**
   * Get latest version of a schema by name and issuer
   */
  async getLatestVersion(params: SchemaByNameDTO): Promise<VCSchema> {
    try {
      this.logStart("Get latest version", `${params.name} by ${params.issuerDid}`);

      const schema = await prisma.vCSchema.findFirst({
        where: {
          name: params.name,
          issuer_did: params.issuerDid,
        },
        orderBy: {
          version: "desc",
        },
      });

      if (!schema) {
        throw new NotFoundError(
          `${SCHEMA_CONSTANTS.MESSAGES.NOT_FOUND}: "${params.name}" for issuer ${params.issuerDid}`
        );
      }

      this.logSuccess("Get latest version", `v${schema.version} (ID: ${schema.id})`);
      return schema;
    } catch (error: any) {
      this.logError("Get latest version", error);
      throw error;
    }
  }

  /**
   * Get all versions of a schema
   */
  async getAllVersions(params: SchemaByNameDTO): Promise<VCSchema[]> {
    try {
      this.logStart("Get all versions", params.name);

      const schemas = await prisma.vCSchema.findMany({
        where: {
          name: params.name,
          issuer_did: params.issuerDid,
        },
        orderBy: {
          version: "asc",
        },
      });

      this.logSuccess("Get all versions", `Found ${schemas.length} version(s)`);
      return schemas;
    } catch (error: any) {
      this.logError("Get all versions", error);
      throw error;
    }
  }

  /**
   * Check if schema is active
   */
  async isActive(id: string): Promise<SchemaActiveStatusDTO> {
    try {
      const schema = await this.getSchemaById(id);
      return {
        id: schema.id,
        isActive: schema.isActive,
      };
    } catch (error: any) {
      this.logError("Check active status", error);
      throw error;
    }
  }

  // ============================================
  // 🔹 WRITE METHODS (Database + Blockchain)
  // ============================================

  /**
   * Create new VC schema (version 1)
   */
  async create(data: CreateVCSchemaDTO): Promise<VCSchemaOperationResponseDTO> {
    this.logStart("Create schema", data.name);

    let createdSchema: VCSchema | null = null;

    try {
      // 1. Create in database
      createdSchema = await prisma.vCSchema.create({
        data: {
          name: data.name,
          schema: data.schema as Prisma.InputJsonValue,
          issuer_did: data.issuer_did,
          version: SCHEMA_CONSTANTS.INITIAL_VERSION,
          isActive: true,
        },
      });

      this.logSuccess("Create schema in DB", `${createdSchema.id} v1`);

      // 2. Create in blockchain
      const schemaString = this.toBlockchainFormat(data.schema);
      const receipt = await this.blockchainService.createVCSchemaInBlockchain(
        createdSchema.id,
        data.name,
        schemaString,
        data.issuer_did
      );

      this.logSuccess("Create schema in blockchain", `TX: ${receipt.hash}`);

      return {
        message: SCHEMA_CONSTANTS.MESSAGES.CREATED,
        schema: createdSchema,
        transaction_hash: receipt.hash,
      };
    } catch (error: any) {
      // Rollback database if blockchain fails
      if (createdSchema) {
        logger.warn(`[SchemaService] Rolling back database for schema: ${createdSchema.id}`);
        await prisma.vCSchema.delete({ where: { id: createdSchema.id } }).catch(() => {});
      }

      this.logError("Create schema", error);
      throw new BadRequestError(
        `${SCHEMA_CONSTANTS.MESSAGES.BLOCKCHAIN_FAILED}: ${error.message}`
      );
    }
  }

  /**
   * Update schema (creates new version)
   */
  async update(
    id: string,
    data: UpdateVCSchemaDTO
  ): Promise<VCSchemaOperationResponseDTO> {
    this.logStart("Update schema", id);

    let newVersionSchema: VCSchema | null = null;

    try {
      // 1. Get existing schema
      const existingSchema = await this.getSchemaById(id);

      // 2. Create new version in database
      const newVersion = existingSchema.version + 1;
      newVersionSchema = await prisma.vCSchema.create({
        data: {
          name: existingSchema.name,
          schema: data.schema as Prisma.InputJsonValue,
          issuer_did: existingSchema.issuer_did,
          version: newVersion,
          isActive: true,
        },
      });

      this.logSuccess("Update schema in DB", `${newVersionSchema.id} v${newVersion}`);

      // 3. Update in blockchain
      const schemaString = this.toBlockchainFormat(data.schema);
      const receipt = await this.blockchainService.updateVCSchemaInBlockchain(
        existingSchema.id,
        schemaString
      );

      this.logSuccess("Update schema in blockchain", `TX: ${receipt.hash}`);

      return {
        message: SCHEMA_CONSTANTS.MESSAGES.UPDATED,
        schema: newVersionSchema,
        transaction_hash: receipt.hash,
      };
    } catch (error: any) {
      // Rollback database if blockchain fails
      if (newVersionSchema) {
        logger.warn(`[SchemaService] Rolling back database for schema: ${newVersionSchema.id}`);
        await prisma.vCSchema.delete({ where: { id: newVersionSchema.id } }).catch(() => {});
      }

      this.logError("Update schema", error);
      throw new BadRequestError(
        `${SCHEMA_CONSTANTS.MESSAGES.BLOCKCHAIN_FAILED}: ${error.message}`
      );
    }
  }

  /**
   * Deactivate schema
   */
  async deactivate(id: string): Promise<VCSchemaOperationResponseDTO> {
    this.logStart("Deactivate schema", id);

    try {
      // 1. Get schema
      const schema = await this.getSchemaById(id);

      if (!schema.isActive) {
        throw new BadRequestError(SCHEMA_CONSTANTS.MESSAGES.ALREADY_INACTIVE);
      }

      // 2. Deactivate in database
      const deactivatedSchema = await prisma.vCSchema.update({
        where: { id },
        data: { isActive: false },
      });

      this.logSuccess("Deactivate schema in DB", id);

      // 3. Deactivate in blockchain
      const receipt = await this.blockchainService.deactivateVCSchemaInBlockchain(
        schema.id,
        schema.version
      );

      this.logSuccess("Deactivate schema in blockchain", `TX: ${receipt.hash}`);

      return {
        message: SCHEMA_CONSTANTS.MESSAGES.DEACTIVATED,
        schema: deactivatedSchema,
        transaction_hash: receipt.hash,
      };
    } catch (error: any) {
      // Rollback database if blockchain fails
      if (error instanceof BadRequestError && error.message.includes("Blockchain")) {
        logger.warn(`[SchemaService] Rolling back deactivation for schema: ${id}`);
        await prisma.vCSchema.update({ where: { id }, data: { isActive: true } }).catch(() => {});
      }

      this.logError("Deactivate schema", error);
      
      if (error instanceof BadRequestError) {
        throw error;
      }

      throw new BadRequestError(
        `${SCHEMA_CONSTANTS.MESSAGES.BLOCKCHAIN_FAILED}: ${error.message}`
      );
    }
  }

  /**
   * Reactivate schema
   */
  async reactivate(id: string): Promise<VCSchemaOperationResponseDTO> {
    this.logStart("Reactivate schema", id);

    try {
      // 1. Get schema
      const schema = await this.getSchemaById(id);

      if (schema.isActive) {
        throw new BadRequestError(SCHEMA_CONSTANTS.MESSAGES.ALREADY_ACTIVE);
      }

      // 2. Reactivate in database
      const reactivatedSchema = await prisma.vCSchema.update({
        where: { id },
        data: { isActive: true },
      });

      this.logSuccess("Reactivate schema in DB", id);

      // 3. Reactivate in blockchain
      const receipt = await this.blockchainService.reactivateVCSchemaInBlockchain(
        schema.id,
        schema.version
      );

      this.logSuccess("Reactivate schema in blockchain", `TX: ${receipt.hash}`);

      return {
        message: SCHEMA_CONSTANTS.MESSAGES.REACTIVATED,
        schema: reactivatedSchema,
        transaction_hash: receipt.hash,
      };
    } catch (error: any) {
      // Rollback database if blockchain fails
      if (error instanceof BadRequestError && error.message.includes("Blockchain")) {
        logger.warn(`[SchemaService] Rolling back reactivation for schema: ${id}`);
        await prisma.vCSchema.update({ where: { id }, data: { isActive: false } }).catch(() => {});
      }

      this.logError("Reactivate schema", error);
      
      if (error instanceof BadRequestError) {
        throw error;
      }

      throw new BadRequestError(
        `${SCHEMA_CONSTANTS.MESSAGES.BLOCKCHAIN_FAILED}: ${error.message}`
      );
    }
  }

  /**
   * Delete schema (soft delete - deactivate)
   */
  async delete(id: string): Promise<SchemaDeleteResponseDTO> {
    try {
      const result = await this.deactivate(id);
      return {
        message: SCHEMA_CONSTANTS.MESSAGES.DELETED,
        transaction_hash: result.transaction_hash,
      };
    } catch (error: any) {
      this.logError("Delete schema", error);
      throw error;
    }
  }
}

// Export singleton instance
export default new SchemaService();

// Export class for testing
export { SchemaService };
