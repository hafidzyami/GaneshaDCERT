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
   * Uses pagination with limit 10 per call to avoid memory allocation errors
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

      console.log(`📊 [PerformanceService] Total schemas in blockchain: ${totalCount}`);

      // Pagination settings
      const LIMIT_PER_CALL = 10; // Limit 10 schemas per call to avoid memory errors
      const totalPages = Math.ceil(totalCount / LIMIT_PER_CALL);
      const allSchemas: any[] = [];

      console.log(`📄 [PerformanceService] Will fetch ${totalPages} pages with limit ${LIMIT_PER_CALL} per page`);

      // Fetch schemas page by page
      for (let page = 1; page <= totalPages; page++) {
        console.log(`🔄 [PerformanceService] Fetching page ${page}/${totalPages}...`);

        const result = await VCBlockchainService.getAllSchemasFromBlockchain(
          page,
          LIMIT_PER_CALL,
          false // Get all versions
        );

        // Parse schema JSON strings to objects
        const parsedSchemas = result.schemas.map(schema => this.parseSchemaJson(schema));
        allSchemas.push(...parsedSchemas);

        console.log(`✓ Page ${page}/${totalPages} retrieved: ${parsedSchemas.length} schemas`);
      }

      console.log(
        `✅ [PerformanceService] Retrieved total ${allSchemas.length} schemas from blockchain in ${totalPages} calls`
      );
      return allSchemas;
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
