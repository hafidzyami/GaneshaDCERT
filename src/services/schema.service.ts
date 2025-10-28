import { BadRequestError, NotFoundError } from "../utils/errors/AppError";
import logger from "../config/logger";
import VCBlockchainService from "./blockchain/vcBlockchain.service";
import DIDBlockchainService from "./blockchain/didBlockchain.service";
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
  private vcBlockchainService: typeof VCBlockchainService;
  private didBlockchainService: typeof DIDBlockchainService;

  constructor(
    vcBlockchainService?: typeof VCBlockchainService,
    didBlockchainService?: typeof DIDBlockchainService
  ) {
    this.vcBlockchainService = vcBlockchainService || VCBlockchainService;
    this.didBlockchainService = didBlockchainService || DIDBlockchainService;
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
  // 🔹 PUBLIC GETTER METHODS (Database Only)
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
        orderBy: [{ issuer_did: "asc" }, { name: "asc" }, { version: "desc" }],
      });

      for (const schema of schemas) {
        if (!schema.issuer_name) {
          try {
            // Get DID document from blockchain
            const didDocument = await DIDBlockchainService.getDIDDocument(
              schema.issuer_did
            );

            // Extract name from DID document
            const issuerName = didDocument.details?.name || null;

            if (issuerName) {
              // Update schema with issuer name using composite key
              await prisma.vCSchema.update({
                where: {
                  id_version: {
                    id: schema.id,
                    version: schema.version,
                  },
                },
                data: { issuer_name: issuerName },
              });
            }
          } catch (error) {
            console.error(`❌ Failed to process schema ${schema.id}`);
          }
        }
      }

      this.logSuccess(
        "Get all schemas",
        `Retrieved ${schemas.length} schema(s)`
      );
      return schemas;
    } catch (error: any) {
      this.logError("Get all schemas", error);
      throw error;
    }
  }

  /**
   * Get all versions of a schema by ID only
   */
  async getAllVersionsById(id: string): Promise<VCSchema[]> {
    try {
      this.logStart("Get all versions by ID", id);

      const schemas = await prisma.vCSchema.findMany({
        where: { id },
        orderBy: { version: "desc" },
      });

      if (schemas.length === 0) {
        throw new NotFoundError(
          `${SCHEMA_CONSTANTS.MESSAGES.NOT_FOUND}: ${id}`
        );
      }

      this.logSuccess(
        "Get all versions by ID",
        `Found ${schemas.length} version(s)`
      );
      return schemas;
    } catch (error: any) {
      this.logError("Get all versions by ID", error);
      throw error;
    }
  }

  /**
   * Get schema by ID and Version (both required)
   */
  async getSchemaByIdAndVersion(
    id: string,
    version: number
  ): Promise<VCSchema> {
    try {
      this.logStart("Get schema by ID and version", `${id} v${version}`);

      const schema = await prisma.vCSchema.findUnique({
        where: {
          id_version: {
            id,
            version,
          },
        },
      });

      if (!schema) {
        throw new NotFoundError(
          `${SCHEMA_CONSTANTS.MESSAGES.NOT_FOUND}: ${id} v${version}`
        );
      }

      this.logSuccess(
        "Get schema by ID and version",
        `${id} v${schema.version}`
      );
      return schema;
    } catch (error: any) {
      this.logError("Get schema by ID and version", error);
      throw error;
    }
  }

  /**
   * Internal helper: Get schema by ID with optional version
   * Used internally by other methods (deactivate, reactivate, etc)
   */
  async getSchemaById(id: string, version?: number): Promise<VCSchema> {
    if (version !== undefined) {
      return this.getSchemaByIdAndVersion(id, version);
    }

    // Get latest version
    const schemas = await this.getAllVersionsById(id);
    return schemas[0]; // Already sorted by version desc
  }

  /**
   * Get schema by ID
   */
  async getLastSchemaById(id: string): Promise<VCSchema> {
    try {
      this.logStart("Get schema by ID", id);

      const schema = await prisma.vCSchema.findFirst({
        where: { id },
        orderBy: { version: "desc" },
      });

      if (!schema) {
        throw new NotFoundError(
          `${SCHEMA_CONSTANTS.MESSAGES.NOT_FOUND}: ${id}`
        );
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
      this.logStart(
        "Get latest version",
        `${params.name} by ${params.issuerDid}`
      );

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

      this.logSuccess(
        "Get latest version",
        `v${schema.version} (ID: ${schema.id})`
      );
      return schema;
    } catch (error: any) {
      this.logError("Get latest version", error);
      throw error;
    }
  }

  /**
   * Get all versions of a schema by name and issuer
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
   * @param id - Schema ID
   * @param version - Optional version number. If not provided, checks the latest version
   */
  async isActive(id: string, version?: number): Promise<SchemaActiveStatusDTO> {
    try {
      const schema = await this.getSchemaById(id, version);
      return {
        id: schema.id,
        version: schema.version,
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
      const issuer_did_document =
        await this.didBlockchainService.getDIDDocument(data.issuer_did);

      // Safe property access dengan optional chaining
      const issuerName = issuer_did_document?.data?.details?.name || null;

      // 1. Create in database
      createdSchema = await prisma.vCSchema.create({
        data: {
          name: data.name,
          schema: data.schema as Prisma.InputJsonValue,
          issuer_did: data.issuer_did,
          issuer_name: issuerName,
          version: SCHEMA_CONSTANTS.INITIAL_VERSION,
          isActive: true,
        },
      });

      this.logSuccess("Create schema in DB", `${createdSchema.id} v1`);

      // 2. Create in blockchain
      const schemaString = this.toBlockchainFormat(data.schema);
      const receipt = await this.vcBlockchainService.createVCSchemaInBlockchain(
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
        logger.warn(
          `[SchemaService] Rolling back database for schema: ${createdSchema.id} v${createdSchema.version}`
        );
        await prisma.vCSchema
          .delete({
            where: {
              id_version: {
                id: createdSchema.id,
                version: createdSchema.version,
              },
            },
          })
          .catch(() => {});
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
      const existingSchema = await this.getLastSchemaById(id);

      // 2. Create new version in database
      const newVersion = existingSchema.version + 1;
      newVersionSchema = await prisma.vCSchema.create({
        data: {
          id: existingSchema.id,
          name: existingSchema.name,
          schema: data.schema as Prisma.InputJsonValue,
          issuer_did: existingSchema.issuer_did,
          issuer_name: existingSchema.issuer_name,
          version: newVersion,
          isActive: true,
        },
      });

      this.logSuccess(
        "Update schema in DB",
        `${newVersionSchema.id} v${newVersion}`
      );

      // 3. Update in blockchain
      const schemaString = this.toBlockchainFormat(data.schema);
      const receipt = await this.vcBlockchainService.updateVCSchemaInBlockchain(
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
        logger.warn(
          `[SchemaService] Rolling back database for schema: ${newVersionSchema.id} v${newVersionSchema.version}`
        );
        await prisma.vCSchema
          .delete({
            where: {
              id_version: {
                id: newVersionSchema.id,
                version: newVersionSchema.version,
              },
            },
          })
          .catch(() => {});
      }

      this.logError("Update schema", error);
      throw new BadRequestError(
        `${SCHEMA_CONSTANTS.MESSAGES.BLOCKCHAIN_FAILED}: ${error.message}`
      );
    }
  }

  /**
   * Deactivate schema
   * @param id - Schema ID
   * @param version - Optional version number. If not provided, deactivates the latest version
   */
  async deactivate(
    id: string,
    version?: number
  ): Promise<VCSchemaOperationResponseDTO> {
    this.logStart(
      "Deactivate schema",
      `${id}${version ? ` v${version}` : " (latest)"}`
    );

    try {
      // 1. Get schema
      const schema = await this.getSchemaById(id, version);

      if (!schema.isActive) {
        throw new BadRequestError(SCHEMA_CONSTANTS.MESSAGES.ALREADY_INACTIVE);
      }

      // 2. Deactivate in database
      const deactivatedSchema = await prisma.vCSchema.update({
        where: {
          id_version: {
            id: schema.id,
            version: schema.version,
          },
        },
        data: { isActive: false },
      });

      this.logSuccess("Deactivate schema in DB", id);

      // 3. Deactivate in blockchain
      const receipt =
        await this.vcBlockchainService.deactivateVCSchemaInBlockchain(
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
      if (
        error instanceof BadRequestError &&
        error.message.includes("Blockchain")
      ) {
        const schema = await this.getSchemaById(id, version).catch(() => null);
        if (schema) {
          logger.warn(
            `[SchemaService] Rolling back deactivation for schema: ${id} v${schema.version}`
          );
          await prisma.vCSchema
            .update({
              where: {
                id_version: {
                  id: schema.id,
                  version: schema.version,
                },
              },
              data: { isActive: true },
            })
            .catch(() => {});
        }
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
   * @param id - Schema ID
   * @param version - Optional version number. If not provided, reactivates the latest version
   */
  async reactivate(
    id: string,
    version?: number
  ): Promise<VCSchemaOperationResponseDTO> {
    this.logStart(
      "Reactivate schema",
      `${id}${version ? ` v${version}` : " (latest)"}`
    );

    try {
      // 1. Get schema
      const schema = await this.getSchemaById(id, version);

      if (schema.isActive) {
        throw new BadRequestError(SCHEMA_CONSTANTS.MESSAGES.ALREADY_ACTIVE);
      }

      // 2. Reactivate in database
      const reactivatedSchema = await prisma.vCSchema.update({
        where: {
          id_version: {
            id: schema.id,
            version: schema.version,
          },
        },
        data: { isActive: true },
      });

      this.logSuccess("Reactivate schema in DB", id);

      // 3. Reactivate in blockchain
      const receipt =
        await this.vcBlockchainService.reactivateVCSchemaInBlockchain(
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
      if (
        error instanceof BadRequestError &&
        error.message.includes("Blockchain")
      ) {
        const schema = await this.getSchemaById(id, version).catch(() => null);
        if (schema) {
          logger.warn(
            `[SchemaService] Rolling back reactivation for schema: ${id} v${schema.version}`
          );
          await prisma.vCSchema
            .update({
              where: {
                id_version: {
                  id: schema.id,
                  version: schema.version,
                },
              },
              data: { isActive: false },
            })
            .catch(() => {});
        }
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
   * @param id - Schema ID
   * @param version - Optional version number. If not provided, deletes the latest version
   */
  async delete(id: string, version?: number): Promise<SchemaDeleteResponseDTO> {
    try {
      const result = await this.deactivate(id, version);
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
