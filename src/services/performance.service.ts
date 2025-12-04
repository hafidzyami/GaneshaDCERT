import { prisma } from "../config/database";
import VCBlockchainService from "./blockchain/vcBlockchain.service";
import { NotFoundError } from "../utils/errors/AppError";

/**
 * Performance Testing Service
 * Service for benchmarking database vs blockchain performance
 */
class PerformanceService {
  /**
   * Helper function to parse schema JSON string to object
   */
  private parseSchemaJson(schema: any): any {
    try {
      if (typeof schema.schema === 'string') {
        return {
          ...schema,
          schema: JSON.parse(schema.schema)
        };
      }
      return schema;
    } catch (error) {
      console.warn(`Failed to parse schema JSON for ${schema.id}:`, error);
      return schema;
    }
  }

  /**
   * Get all schemas from database
   * Raw query without pagination for performance testing
   */
  async getAllSchemasFromDatabase(): Promise<any[]> {
    try {
      console.log("🔍 [PerformanceService] Fetching all schemas from database...");

      const schemas = await prisma.vCSchema.findMany({
        orderBy: [{ id: "asc" }, { version: "desc" }],
      });

      console.log(`✅ [PerformanceService] Retrieved ${schemas.length} schemas from database`);
      return schemas;
    } catch (error: any) {
      console.error("❌ [PerformanceService] Failed to fetch schemas from database:", error);
      throw error;
    }
  }

  /**
   * Get all schemas from blockchain
   * Uses pagination internally but returns all results for performance testing
   */
  async getAllSchemasFromBlockchain(): Promise<any[]> {
    try {
      console.log("🔍 [PerformanceService] Fetching all schemas from blockchain...");

      // Get total count first
      const totalCount = await VCBlockchainService.getSchemasCountFromBlockchain();

      if (totalCount === 0) {
        console.log("✅ [PerformanceService] No schemas found in blockchain");
        return [];
      }

      // Fetch all schemas in one call with large limit
      const result = await VCBlockchainService.getAllSchemasFromBlockchain(
        1,
        Math.min(totalCount, 1000), // Max 1000 per call due to contract limit
        false // Get all versions
      );

      // Parse schema JSON strings to objects
      const parsedSchemas = result.schemas.map(schema => this.parseSchemaJson(schema));

      console.log(
        `✅ [PerformanceService] Retrieved ${parsedSchemas.length} schemas from blockchain`
      );
      return parsedSchemas;
    } catch (error: any) {
      console.error("❌ [PerformanceService] Failed to fetch schemas from blockchain:", error);
      throw error;
    }
  }

  /**
   * Get specific schema from database by ID and version
   */
  async getSchemaFromDatabase(
    schemaId: string,
    version: number
  ): Promise<any> {
    try {
      console.log(`🔍 [PerformanceService] Fetching schema ${schemaId} v${version} from database...`);

      const schema = await prisma.vCSchema.findUnique({
        where: {
          id_version: {
            id: schemaId,
            version: version,
          },
        },
      });

      if (!schema) {
        throw new NotFoundError(
          `Schema with ID ${schemaId} version ${version} not found in database`
        );
      }

      console.log(`✅ [PerformanceService] Retrieved schema ${schemaId} v${version} from database`);
      return schema;
    } catch (error: any) {
      console.error(
        `❌ [PerformanceService] Failed to fetch schema ${schemaId} v${version} from database:`,
        error
      );
      throw error;
    }
  }

  /**
   * Get specific schema from blockchain by ID and version
   */
  async getSchemaFromBlockchain(
    schemaId: string,
    version: number
  ): Promise<any> {
    try {
      console.log(`🔍 [PerformanceService] Fetching schema ${schemaId} v${version} from blockchain...`);

      const schema = await VCBlockchainService.getSchemaFromBlockchain(
        schemaId,
        version
      );

      // Parse schema JSON string to object
      const parsedSchema = this.parseSchemaJson(schema);

      console.log(`✅ [PerformanceService] Retrieved schema ${schemaId} v${version} from blockchain`);
      return parsedSchema;
    } catch (error: any) {
      console.error(
        `❌ [PerformanceService] Failed to fetch schema ${schemaId} v${version} from blockchain:`,
        error
      );
      throw error;
    }
  }
}

export default new PerformanceService();
