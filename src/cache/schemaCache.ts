/**
 * Schema Cache using RocksDB
 * High-performance cache layer for VCSchema objects with microsecond read latency
 * 
 * Key Structure:
 * - schema!{id}!{version}          → Full schema JSON
 * - latest!{id}                    → Pointer to latest version
 * - active!{id}!{version}          → Presence = schema is active
 * - issuer!{issuerDid}!{id}!{ver}  → Group by issuer
 */

import { Level } from "level";
import { rocksdb, createRocksDBOptions } from "./rocksdbConfig";
import logger from "../config/logger";

// VCSchema type matching Prisma model
export interface VCSchemaCache {
  id: string;
  version: number;
  name: string;
  schema: any; // JSON
  issuer_did: string;
  issuer_name: string | null;
  image_link: string | null;
  expired_in: number | null;
  isActive: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
}

// Cache configuration
const DB_PATH = "./vcschema-cache";
const options = {
  db: rocksdb,
  valueEncoding: "json",
  ...createRocksDBOptions(),
};

// Key generation helpers
const keyPrimary = (id: string, version: number): string =>
  `schema!${id}!${version}`;

const keyLatest = (id: string): string => `latest!${id}`;

const keyActive = (id: string, version: number): string =>
  `active!${id}!${version}`;

const keyIssuer = (issuer: string, id: string, version: number): string =>
  `issuer!${issuer}!${id}!${version}`;

// Database instance
let db: Level<string, any> | null = null;
let isInitialized = false;

/**
 * Initialize the RocksDB cache
 */
export async function initializeCache(): Promise<void> {
  if (isInitialized) {
    logger.warn("Schema cache already initialized");
    return;
  }

  try {
    db = new Level(DB_PATH, options);
    await db.open();
    isInitialized = true;
    logger.success("Schema cache (RocksDB) initialized successfully");
  } catch (error) {
    logger.error("Failed to initialize schema cache:", error);
    throw error;
  }
}

/**
 * Close the RocksDB cache
 */
export async function closeCache(): Promise<void> {
  if (!isInitialized || !db) {
    return;
  }

  try {
    await db.close();
    isInitialized = false;
    logger.info("Schema cache closed");
  } catch (error) {
    logger.error("Error closing schema cache:", error);
    throw error;
  }
}

/**
 * Check if cache is initialized
 */
export function isCacheInitialized(): boolean {
  return isInitialized;
}

/**
 * Put/Update a schema in the cache
 */
export async function putSchema(schema: VCSchemaCache): Promise<void> {
  if (!isInitialized || !db) {
    logger.warn("Cache not initialized, skipping putSchema");
    return;
  }

  try {
    const batch = db.batch();

    // 1. Store primary schema data
    const primary = keyPrimary(schema.id, schema.version);
    batch.put(primary, schema);

    // 2. Update latest version pointer
    const latestKey = keyLatest(schema.id);
    try {
      const val = await db.get(latestKey).catch(() => null);
      if (!val) {
        // First version for this schema
        batch.put(latestKey, `${schema.id}:${schema.version}`);
      } else {
        // Check if this is a newer version
        const parts = val.split(":");
        const currentVersion = Number(parts[1]);
        if (schema.version >= currentVersion) {
          batch.put(latestKey, `${schema.id}:${schema.version}`);
        }
      }
    } catch (error) {
      // If error reading latest, just set it
      batch.put(latestKey, `${schema.id}:${schema.version}`);
    }

    // 3. Update active status index
    const active = keyActive(schema.id, schema.version);
    if (schema.isActive) {
      batch.put(active, 1);
    } else {
      batch.del(active);
    }

    // 4. Update issuer index (optional)
    if (schema.issuer_did) {
      batch.put(keyIssuer(schema.issuer_did, schema.id, schema.version), 1);
    }

    await batch.write();
    logger.debug(`Schema cached: ${schema.id} v${schema.version}`);
  } catch (error) {
    logger.error(`Error caching schema ${schema.id} v${schema.version}:`, error);
    // Don't throw - cache failures shouldn't break the application
  }
}

/**
 * Remove a schema from the cache
 */
export async function removeSchema(id: string, version: number): Promise<void> {
  if (!isInitialized || !db) {
    logger.warn("Cache not initialized, skipping removeSchema");
    return;
  }

  try {
    const batch = db.batch();
    batch.del(keyPrimary(id, version));
    batch.del(keyActive(id, version));
    await batch.write();
    logger.debug(`Schema removed from cache: ${id} v${version}`);
  } catch (error) {
    logger.error(`Error removing schema ${id} v${version} from cache:`, error);
    // Don't throw - cache failures shouldn't break the application
  }
}

/**
 * Get a specific schema version from cache
 */
export async function getSchema(
  id: string,
  version: number
): Promise<VCSchemaCache | null> {
  if (!isInitialized || !db) {
    return null;
  }

  try {
    const schema = await db.get(keyPrimary(id, version));
    return schema;
  } catch (error) {
    // Cache miss or error
    return null;
  }
}

/**
 * Get the latest version of a schema from cache
 */
export async function getLatestSchema(id: string): Promise<VCSchemaCache | null> {
  if (!isInitialized || !db) {
    return null;
  }

  try {
    const val = await db.get(keyLatest(id));
    const [schemaId, versionStr] = val.split(":");
    const version = Number(versionStr);
    return getSchema(schemaId, version);
  } catch (error) {
    // Cache miss or error
    return null;
  }
}

/**
 * Get cache statistics (for monitoring)
 */
export interface CacheStats {
  isInitialized: boolean;
  dbPath: string;
}

export function getCacheStats(): CacheStats {
  return {
    isInitialized,
    dbPath: DB_PATH,
  };
}

// Export db instance for advanced usage
export { db };
