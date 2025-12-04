import { BadRequestError, NotFoundError } from "../utils/errors/AppError";
import logger from "../config/logger";
import VCBlockchainService from "./blockchain/vcBlockchain.service";
import DIDBlockchainService from "./blockchain/didBlockchain.service";
import StorageService from "./storage.service";
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
import { v4 as uuidv4 } from "uuid";

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

    if (filter.isActive !== undefined) {
      where.isActive = filter.isActive;
    }

    return where;
  }

  // ============================================
  // 🔹 PUBLIC GETTER METHODS (Database Only)
  // ============================================

  /**
   * Get all VC schemas with optional filters (from RDBMS)
   */
  async getAllSchemas(filter: SchemaFilterDTO = {}): Promise<VCSchema[]> {
    try {
      this.logStart("Get all schemas from RDBMS", JSON.stringify(filter));

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
        "Get all schemas from RDBMS",
        `Retrieved ${schemas.length} schema(s)`
      );
      return schemas;
    } catch (error: any) {
      this.logError("Get all schemas from RDBMS", error);
      throw error;
    }
  }

  /**
   * Get all VC schemas directly from blockchain with pagination
   * @param page - Page number (default: 1)
   * @param limit - Items per page (default: 100, max: 1000)
   * @param latestOnly - Return only latest versions (default: true)
   */
  async getAllSchemasFromBlockchain(
    page: number = 1,
    limit: number = 100,
    latestOnly: boolean = true
  ): Promise<any> {
    try {
      this.logStart(
        "Get all schemas from blockchain",
        `Page ${page}, limit ${limit}, latestOnly: ${latestOnly}`
      );

      const result = await this.vcBlockchainService.getAllSchemasFromBlockchain(
        page,
        limit,
        latestOnly
      );

      this.logSuccess(
        "Get all schemas from blockchain",
        `Retrieved ${result.pagination.returned} of ${result.pagination.total} schema(s)`
      );

      return result;
    } catch (error: any) {
      this.logError("Get all schemas from blockchain", error);
      throw error;
    }
  }

  /**
   * Get total count of schemas from blockchain
   */
  async getSchemasCountFromBlockchain(): Promise<number> {
    try {
      this.logStart("Get schemas count from blockchain", "");

      const count = await this.vcBlockchainService.getSchemasCountFromBlockchain();

      this.logSuccess("Get schemas count from blockchain", `Count: ${count}`);
      return count;
    } catch (error: any) {
      this.logError("Get schemas count from blockchain", error);
      throw error;
    }
  }

  /**
   * Get specific schema version from blockchain
   * @param schemaId - Schema ID
   * @param version - Schema version
   */
  async getSchemaFromBlockchain(schemaId: string, version: number): Promise<any> {
    try {
      this.logStart("Get schema from blockchain", `${schemaId} v${version}`);

      const schema = await this.vcBlockchainService.getSchemaFromBlockchain(
        schemaId,
        version
      );

      this.logSuccess("Get schema from blockchain", `Retrieved ${schemaId} v${version}`);
      return schema;
    } catch (error: any) {
      this.logError("Get schema from blockchain", error);
      throw error;
    }
  }

  /**
   * Get latest schema version from blockchain
   * @param schemaId - Schema ID
   */
  async getLatestSchemaFromBlockchain(schemaId: string): Promise<any> {
    try {
      this.logStart("Get latest schema from blockchain", schemaId);

      const schema = await this.vcBlockchainService.getLatestSchemaFromBlockchain(
        schemaId
      );

      this.logSuccess(
        "Get latest schema from blockchain",
        `Retrieved ${schemaId} v${schema.version}`
      );
      return schema;
    } catch (error: any) {
      this.logError("Get latest schema from blockchain", error);
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
   * Only writes to blockchain - database will be updated via event listener
   */
  async create(
    data: CreateVCSchemaDTO,
    imageBuffer?: Buffer,
    imageMimeType?: string
  ): Promise<any> {
    this.logStart("Create schema", data.name);

    let uploadedImageUrl: string | null = null;
    let uploadedImageFileName: string | null = null;
    let schemaId: string | null = null;

    try {
      // Generate schema ID
      schemaId = uuidv4();

      // Upload image to MinIO if provided
      if (imageBuffer) {
        try {
          uploadedImageFileName = `${uuidv4()}`;
          const uploadResult = await StorageService.uploadFile(
            "background",
            uploadedImageFileName,
            imageBuffer,
            imageMimeType
          );
          uploadedImageUrl = uploadResult.url;
          this.logSuccess(
            "Upload schema background image",
            uploadResult.filePath
          );
        } catch (uploadError: any) {
          logger.error(
            "Failed to upload schema background image:",
            uploadError
          );
          throw new BadRequestError(
            `Image upload failed: ${uploadError.message}`
          );
        }
      }

      // Create in blockchain only - event listener will update database
      logger.info("Data :", data);
      logger.info("Schema :", data.schema);
      const schemaString = this.toBlockchainFormat(data.schema);
      logger.info("Schema String:", schemaString);
      const receipt = await this.vcBlockchainService.createVCSchemaInBlockchain(
        schemaId,
        data.name,
        schemaString,
        data.issuer_did,
        uploadedImageUrl || ""
      );

      this.logSuccess("Create schema in blockchain", `TX: ${receipt.hash}`);

      return {
        message: `${SCHEMA_CONSTANTS.MESSAGES.CREATED} (Database will be synced via event listener)`,
        schema: {
          id: schemaId,
          version: SCHEMA_CONSTANTS.INITIAL_VERSION,
          name: data.name,
          schema: data.schema as any,
          issuer_did: data.issuer_did,
          issuer_name: null,
          image_link: uploadedImageUrl,
          expired_in: data.expired_in ?? null,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        transaction_hash: receipt.hash,
      };
    } catch (error: any) {
      // Rollback uploaded image if exists
      if (uploadedImageFileName) {
        logger.warn(
          `[SchemaService] Rolling back uploaded image: ${uploadedImageFileName}`
        );
        await StorageService.deleteFile(
          "background",
          uploadedImageFileName
        ).catch(() => {});
      }

      this.logError("Create schema", error);
      throw new BadRequestError(
        `${SCHEMA_CONSTANTS.MESSAGES.BLOCKCHAIN_FAILED}: ${error.message}`
      );
    }
  }

  /**
   * Update schema (creates new version)
   * Only writes to blockchain - database will be updated via event listener
   */
  async update(
    id: string,
    data: UpdateVCSchemaDTO,
    imageBuffer?: Buffer,
    imageMimeType?: string
  ): Promise<any> {
    this.logStart("Update schema", id);

    let uploadedImageUrl: string | null = null;
    let uploadedImageFileName: string | null = null;

    try {
      // 1. Get existing schema to know current version
      const existingSchema = await this.getLastSchemaById(id);

      // Image management logic
      let finalImageLink: string | null = null;

      if (data.image_link) {
        // Keep existing background
        finalImageLink = data.image_link;
        this.logSuccess(
          "Keep existing schema background",
          "Using provided image_link"
        );
      } else if (imageBuffer) {
        // Upload new background image
        try {
          uploadedImageFileName = `${uuidv4()}`;
          const uploadResult = await StorageService.uploadFile(
            "background",
            uploadedImageFileName,
            imageBuffer,
            imageMimeType
          );
          uploadedImageUrl = uploadResult.url;
          finalImageLink = uploadedImageUrl;
          this.logSuccess(
            "Upload new schema background image",
            uploadResult.filePath
          );
        } catch (uploadError: any) {
          logger.error(
            "Failed to upload schema background image:",
            uploadError
          );
          throw new BadRequestError(
            `Image upload failed: ${uploadError.message}`
          );
        }
      } else {
        // Remove background
        finalImageLink = null;
        this.logSuccess(
          "Remove schema background",
          "No image for new version"
        );
      }

      // Update in blockchain only - event listener will update database
      logger.info("Schema: ", data.schema);
      const schemaString = this.toBlockchainFormat(data.schema);
      logger.info("Schema String: ", schemaString);
      const receipt = await this.vcBlockchainService.updateVCSchemaInBlockchain(
        existingSchema.id,
        schemaString,
        finalImageLink || ""
      );

      this.logSuccess("Update schema in blockchain", `TX: ${receipt.hash}`);

      const newVersion = existingSchema.version + 1;
      return {
        message: `${SCHEMA_CONSTANTS.MESSAGES.UPDATED} (Database will be synced via event listener)`,
        schema: {
          id: existingSchema.id,
          name: existingSchema.name,
          schema: data.schema as any,
          issuer_did: existingSchema.issuer_did,
          issuer_name: existingSchema.issuer_name,
          image_link: finalImageLink,
          expired_in: data.expired_in !== undefined ? data.expired_in : existingSchema.expired_in,
          version: newVersion,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        transaction_hash: receipt.hash,
      };
    } catch (error: any) {
      // Rollback uploaded image if exists
      if (uploadedImageFileName) {
        logger.warn(
          `[SchemaService] Rolling back uploaded image: ${uploadedImageFileName}`
        );
        await StorageService.deleteFile(
          "background",
          uploadedImageFileName
        ).catch(() => {});
      }

      this.logError("Update schema", error);
      throw new BadRequestError(
        `${SCHEMA_CONSTANTS.MESSAGES.BLOCKCHAIN_FAILED}: ${error.message}`
      );
    }
  }

  /**
   * Deactivate schema
   * Only writes to blockchain - database will be updated via event listener
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
      // Get schema to verify it exists and is active
      const schema = await this.getSchemaById(id, version);

      if (!schema.isActive) {
        throw new BadRequestError(SCHEMA_CONSTANTS.MESSAGES.ALREADY_INACTIVE);
      }

      // Deactivate in blockchain only - event listener will update database
      const receipt =
        await this.vcBlockchainService.deactivateVCSchemaInBlockchain(
          schema.id,
          schema.version
        );

      this.logSuccess("Deactivate schema in blockchain", `TX: ${receipt.hash}`);

      return {
        message: `${SCHEMA_CONSTANTS.MESSAGES.DEACTIVATED} (Database will be synced via event listener)`,
        schema: {
          ...schema,
          isActive: false,
          updatedAt: new Date(),
        },
        transaction_hash: receipt.hash,
      };
    } catch (error: any) {
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
   * Only writes to blockchain - database will be updated via event listener
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
      // Get schema to verify it exists and is inactive
      const schema = await this.getSchemaById(id, version);

      if (schema.isActive) {
        throw new BadRequestError(SCHEMA_CONSTANTS.MESSAGES.ALREADY_ACTIVE);
      }

      // Reactivate in blockchain only - event listener will update database
      const receipt =
        await this.vcBlockchainService.reactivateVCSchemaInBlockchain(
          schema.id,
          schema.version
        );

      this.logSuccess("Reactivate schema in blockchain", `TX: ${receipt.hash}`);

      return {
        message: `${SCHEMA_CONSTANTS.MESSAGES.REACTIVATED} (Database will be synced via event listener)`,
        schema: {
          ...schema,
          isActive: true,
          updatedAt: new Date(),
        },
        transaction_hash: receipt.hash,
      };
    } catch (error: any) {
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
