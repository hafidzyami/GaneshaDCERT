import { PrismaClient } from "@prisma/client";
import logger from "../../config/logger";
import DIDBlockchainService from "../blockchain/didBlockchain.service";

/**
 * Check if a string is a keccak256 hash (0x + 64 hex characters)
 * Indexed strings in Solidity are hashed with keccak256
 */
function isKeccak256Hash(value: string): boolean {
  if (!value || typeof value !== 'string') return false;
  // keccak256 hash format: 0x + 64 hex characters = 66 total length
  return /^0x[a-fA-F0-9]{64}$/.test(value);
}

/**
 * Schema Event Processor
 * Handles blockchain events related to VC Schemas
 */
class SchemaEventProcessor {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Handle SchemaCreated event
   */
  async handleSchemaCreated(eventData: {
    id: string;
    name: string;
    schema: string;
    issuerDID: string;
    imageLink: string;
    version: number;
    timestamp: number;
  }): Promise<void> {
    logger.info(`Processing SchemaCreated event with data:`, {
      id: eventData.id,
      id_type: typeof eventData.id,
      name: eventData.name,
      issuerDID: eventData.issuerDID,
      issuerDID_type: typeof eventData.issuerDID,
      imageLink: eventData.imageLink,
      version: eventData.version,
      timestamp: eventData.timestamp,
      schemaLength: eventData.schema?.length
    });

    // Validate that critical fields are not keccak256 hashes
    if (isKeccak256Hash(eventData.id)) {
      const errorMsg = `CRITICAL: Cannot save schema - id is still a keccak256 hash: ${eventData.id}. Enrichment failed.`;
      logger.error(errorMsg);
      throw new Error(errorMsg);
    }

    if (isKeccak256Hash(eventData.issuerDID)) {
      const errorMsg = `CRITICAL: Cannot save schema - issuerDID is still a keccak256 hash: ${eventData.issuerDID}. Enrichment failed.`;
      logger.error(errorMsg);
      throw new Error(errorMsg);
    }

    try {
      // Parse schema JSON
      let schemaJson: any;
      try {
        schemaJson = JSON.parse(eventData.schema);
        logger.info(`Parsed schema JSON successfully:`, {
          expired_in: schemaJson?.expired_in,
          expired_in_type: typeof schemaJson?.expired_in,
          hasExpiredIn: 'expired_in' in schemaJson
        });
      } catch (error) {
        logger.error("Failed to parse schema JSON:", error);
        schemaJson = { raw: eventData.schema };
      }

      // Extract expired_in from schema JSON - handle 0 as valid value
      const expiredIn = schemaJson && 'expired_in' in schemaJson ? schemaJson.expired_in : null;
      logger.info(`Extracted expired_in:`, { expiredIn, type: typeof expiredIn });

      // Fetch issuer name from DID Document
      let issuerName: string | null = null;
      try {
        const didDocument = await DIDBlockchainService.getDIDDocumentLegacy(eventData.issuerDID);
        if (didDocument.found && didDocument.details?.name) {
          issuerName = didDocument.details.name;
          logger.info(`Fetched issuer name from DID: ${issuerName}`);
        } else {
          logger.warn(`Could not fetch issuer name from DID: ${eventData.issuerDID}`);
        }
      } catch (error) {
        logger.error(`Error fetching DID document for ${eventData.issuerDID}:`, error);
      }

      // Prepare data for upsert
      const createData = {
        id: eventData.id,
        version: eventData.version,
        name: eventData.name,
        schema: schemaJson,
        issuer_did: eventData.issuerDID,
        issuer_name: issuerName,
        image_link: eventData.imageLink || null,
        expired_in: expiredIn,
        isActive: true,
      };

      logger.info(`Attempting to upsert schema with data:`, {
        id: createData.id,
        id_type: typeof createData.id,
        version: createData.version,
        name: createData.name,
        issuer_did: createData.issuer_did,
        issuer_did_type: typeof createData.issuer_did,
        issuer_name: createData.issuer_name,
        image_link: createData.image_link,
        expired_in: createData.expired_in,
        expired_in_type: typeof createData.expired_in,
        isActive: createData.isActive
      });

      // Upsert schema to database
      logger.info(`Upserting to database with where clause:`, {
        id: eventData.id,
        version: eventData.version
      });

      const result = await this.prisma.vCSchema.upsert({
        where: {
          id_version: {
            id: eventData.id,
            version: eventData.version,
          },
        },
        create: createData,
        update: {
          name: eventData.name,
          schema: schemaJson,
          issuer_did: eventData.issuerDID,
          issuer_name: issuerName,
          image_link: eventData.imageLink || null,
          expired_in: expiredIn,
          isActive: true,
          updatedAt: new Date(),
        },
      });

      logger.success(
        `Schema upserted in database: ${eventData.id} v${eventData.version} (operation: ${result.createdAt.getTime() === result.updatedAt.getTime() ? 'CREATE' : 'UPDATE'})`
      );
    } catch (error: any) {
      logger.error("❌ Error handling SchemaCreated event:", {
        error: error.message,
        errorName: error.name,
        code: error.code,
        stack: error.stack,
        eventData: {
          id: eventData.id,
          id_type: typeof eventData.id,
          name: eventData.name,
          issuerDID: eventData.issuerDID,
          issuerDID_type: typeof eventData.issuerDID,
          imageLink: eventData.imageLink,
          version: eventData.version,
          timestamp: eventData.timestamp
        },
        createData: {
          id: eventData.id,
          version: eventData.version,
          issuer_did: eventData.issuerDID
        }
      });
      throw error;
    }
  }

  /**
   * Handle SchemaUpdated event
   */
  async handleSchemaUpdated(eventData: {
    id: string;
    schema: string;
    issuerDID: string;
    imageLink: string;
    oldVersion: number;
    newVersion: number;
    timestamp: number;
  }): Promise<void> {
    logger.info(
      `Processing SchemaUpdated: ${eventData.id} v${eventData.oldVersion} -> v${eventData.newVersion}`
    );

    // Validate that critical fields are not keccak256 hashes
    if (isKeccak256Hash(eventData.id)) {
      const errorMsg = `CRITICAL: Cannot update schema - id is still a keccak256 hash: ${eventData.id}. Enrichment failed.`;
      logger.error(errorMsg);
      throw new Error(errorMsg);
    }

    if (isKeccak256Hash(eventData.issuerDID)) {
      const errorMsg = `CRITICAL: Cannot update schema - issuerDID is still a keccak256 hash: ${eventData.issuerDID}. Enrichment failed.`;
      logger.error(errorMsg);
      throw new Error(errorMsg);
    }

    try {
      // Get the schema name from old version
      const oldSchema = await this.prisma.vCSchema.findUnique({
        where: {
          id_version: {
            id: eventData.id,
            version: eventData.oldVersion,
          },
        },
      });

      if (!oldSchema) {
        logger.warn(
          `Old schema version ${eventData.id} v${eventData.oldVersion} not found`
        );
      }

      // Parse schema JSON
      let schemaJson: any;
      try {
        schemaJson = JSON.parse(eventData.schema);
        logger.info(`Parsed schema JSON successfully:`, {
          expired_in: schemaJson?.expired_in,
          expired_in_type: typeof schemaJson?.expired_in,
          hasExpiredIn: 'expired_in' in schemaJson
        });
      } catch (error) {
        logger.error("Failed to parse schema JSON:", error);
        schemaJson = { raw: eventData.schema };
      }

      // Extract expired_in from schema JSON - handle 0 as valid value
      const expiredIn = schemaJson && 'expired_in' in schemaJson ? schemaJson.expired_in : null;
      logger.info(`Extracted expired_in:`, { expiredIn, type: typeof expiredIn });

      // Fetch issuer name from DID Document
      let issuerName: string | null = null;
      try {
        const didDocument = await DIDBlockchainService.getDIDDocumentLegacy(eventData.issuerDID);
        if (didDocument.found && didDocument.details?.name) {
          issuerName = didDocument.details.name;
          logger.info(`Fetched issuer name from DID: ${issuerName}`);
        } else {
          logger.warn(`Could not fetch issuer name from DID: ${eventData.issuerDID}`);
        }
      } catch (error) {
        logger.error(`Error fetching DID document for ${eventData.issuerDID}:`, error);
      }

      // Create new version entry (NOT update the old one)
      logger.info(`Creating NEW schema version in database:`, {
        id: eventData.id,
        oldVersion: eventData.oldVersion,
        newVersion: eventData.newVersion,
        oldSchemaExists: !!oldSchema
      });

      const result = await this.prisma.vCSchema.upsert({
        where: {
          id_version: {
            id: eventData.id,
            version: eventData.newVersion, // Query by NEW version
          },
        },
        create: {
          id: eventData.id,
          version: eventData.newVersion,  // Create with NEW version
          name: oldSchema?.name || eventData.id,
          schema: schemaJson,
          issuer_did: eventData.issuerDID,
          issuer_name: issuerName,
          image_link: eventData.imageLink || null,
          expired_in: expiredIn,
          isActive: true,
          createdAt: new Date(eventData.timestamp * 1000),
          updatedAt: new Date(eventData.timestamp * 1000),
        },
        update: {
          // This should rarely happen (only if event processed twice)
          schema: schemaJson,
          issuer_did: eventData.issuerDID,
          issuer_name: issuerName,
          image_link: eventData.imageLink || null,
          expired_in: expiredIn,
          isActive: true,
          updatedAt: new Date(),
        },
      });

      logger.success(
        `Schema version created in database: ${eventData.id} v${eventData.newVersion} (operation: ${result.createdAt.getTime() === result.updatedAt.getTime() ? 'CREATE' : 'UPDATE'})`
      );
      logger.info(`Old version v${eventData.oldVersion} remains unchanged in database`);
    } catch (error) {
      logger.error("Error handling SchemaUpdated event:", error);
      throw error;
    }
  }

  /**
   * Handle SchemaDeactivated event
   */
  async handleSchemaDeactivated(eventData: {
    id: string;
    version: number;
    issuerDID: string;
    timestamp: number;
  }): Promise<void> {
    logger.info(
      `Processing SchemaDeactivated: ${eventData.id} v${eventData.version}`
    );

    // Validate that id is not a keccak256 hash (indexed parameter)
    if (isKeccak256Hash(eventData.id)) {
      const errorMsg = `CRITICAL: Cannot deactivate schema - id is still a keccak256 hash: ${eventData.id}. Enrichment failed.`;
      logger.error(errorMsg);
      throw new Error(errorMsg);
    }

    try {
      // Update isActive to false
      const result = await this.prisma.vCSchema.updateMany({
        where: {
          id: eventData.id,
          version: eventData.version,
        },
        data: {
          isActive: false,
          updatedAt: new Date(),
        },
      });

      if (result.count === 0) {
        logger.warn(
          `Schema ${eventData.id} v${eventData.version} not found for deactivation`
        );
      } else {
        logger.success(
          `Schema deactivated in database: ${eventData.id} v${eventData.version}`
        );
      }
    } catch (error) {
      logger.error("Error handling SchemaDeactivated event:", error);
      throw error;
    }
  }

  /**
   * Handle SchemaReactivated event
   */
  async handleSchemaReactivated(eventData: {
    id: string;
    version: number;
    issuerDID: string;
    timestamp: number;
  }): Promise<void> {
    logger.info(
      `Processing SchemaReactivated: ${eventData.id} v${eventData.version}`
    );

    // Validate that id is not a keccak256 hash (indexed parameter)
    if (isKeccak256Hash(eventData.id)) {
      const errorMsg = `CRITICAL: Cannot reactivate schema - id is still a keccak256 hash: ${eventData.id}. Enrichment failed.`;
      logger.error(errorMsg);
      throw new Error(errorMsg);
    }

    try {
      // Update isActive to true
      const result = await this.prisma.vCSchema.updateMany({
        where: {
          id: eventData.id,
          version: eventData.version,
        },
        data: {
          isActive: true,
          updatedAt: new Date(),
        },
      });

      if (result.count === 0) {
        logger.warn(
          `Schema ${eventData.id} v${eventData.version} not found for reactivation`
        );
      } else {
        logger.success(
          `Schema reactivated in database: ${eventData.id} v${eventData.version}`
        );
      }
    } catch (error) {
      logger.error("Error handling SchemaReactivated event:", error);
      throw error;
    }
  }
}

export default SchemaEventProcessor;
