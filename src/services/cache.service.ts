import redisClient from '../config/redis';
import logger from '../config/logger';

/**
 * Cache TTL Configuration (in seconds)
 * Based on Phase2 Backend Blockchain Tasks specification
 */
export const CACHE_TTL = {
  DID_DOCUMENT: 60 * 60,          // 1 hour
  VC_SCHEMA: 24 * 60 * 60,        // 24 hours
  INSTITUTION_METADATA: 60 * 60,   // 1 hour
  ISSUER_LIST: 15 * 60,           // 15 minutes
  DEFAULT: 60 * 60,               // 1 hour default
} as const;

/**
 * Cache Key Prefixes
 * Used to namespace cache entries and enable pattern-based deletion
 */
export const CACHE_PREFIX = {
  DID_DOCUMENT: 'did:doc:',
  VC_SCHEMA: 'schema:',
  INSTITUTION: 'institution:',
  ISSUER_LIST: 'issuers:',
} as const;

/**
 * DID Document interface for caching
 */
export interface CachedDIDDocument {
  found: boolean;
  status?: string;
  keyId?: string;
  didDocument?: any;
  didDocumentMetadata?: any;
  didResolutionMetadata?: any;
  [key: string]: any;
}

/**
 * Schema interface for caching
 */
export interface CachedSchema {
  id: string;
  version: number;
  name: string;
  issuer_did: string;
  schema: any;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  [key: string]: any;
}

/**
 * Institution interface for caching
 */
export interface CachedInstitution {
  id: string;
  did: string;
  name: string;
  email: string;
  phone?: string;
  country?: string;
  website?: string;
  address?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Cache Service
 * Provides Redis-based caching for DID Documents, Schemas, and Institution data
 */
class CacheService {
  // ============================================
  // GENERIC CACHE METHODS
  // ============================================

  /**
   * Get a value from cache
   * @param key - Cache key
   * @returns Parsed value or null if not found
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await redisClient.get(key);
      if (!value) {
        return null;
      }
      return JSON.parse(value) as T;
    } catch (error) {
      logger.error(`[CacheService] Error getting key ${key}:`, error);
      return null;
    }
  }

  /**
   * Set a value in cache with optional TTL
   * @param key - Cache key
   * @param value - Value to cache
   * @param ttlSeconds - Time to live in seconds (optional)
   */
  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    try {
      const serialized = JSON.stringify(value);
      if (ttlSeconds) {
        await redisClient.setex(key, ttlSeconds, serialized);
      } else {
        await redisClient.set(key, serialized);
      }
      logger.debug(`[CacheService] Set key ${key} with TTL ${ttlSeconds || 'infinite'}s`);
    } catch (error) {
      logger.error(`[CacheService] Error setting key ${key}:`, error);
    }
  }

  /**
   * Delete a specific key from cache
   * @param key - Cache key to delete
   */
  async delete(key: string): Promise<void> {
    try {
      await redisClient.del(key);
      logger.debug(`[CacheService] Deleted key ${key}`);
    } catch (error) {
      logger.error(`[CacheService] Error deleting key ${key}:`, error);
    }
  }

  /**
   * Delete all keys matching a pattern
   * @param pattern - Redis pattern (e.g., 'did:doc:*')
   */
  async deletePattern(pattern: string): Promise<void> {
    try {
      let cursor = '0';
      let deleted = 0;

      do {
        const result = await redisClient.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
        cursor = result[0];
        const keys = result[1];

        if (keys.length > 0) {
          await redisClient.del(...keys);
          deleted += keys.length;
        }
      } while (cursor !== '0');

      logger.debug(`[CacheService] Deleted ${deleted} keys matching pattern ${pattern}`);
    } catch (error) {
      logger.error(`[CacheService] Error deleting pattern ${pattern}:`, error);
    }
  }

  /**
   * Check if a key exists in cache
   * @param key - Cache key
   * @returns true if key exists
   */
  async exists(key: string): Promise<boolean> {
    try {
      const result = await redisClient.exists(key);
      return result === 1;
    } catch (error) {
      logger.error(`[CacheService] Error checking existence of key ${key}:`, error);
      return false;
    }
  }

  /**
   * Get remaining TTL for a key
   * @param key - Cache key
   * @returns TTL in seconds, -1 if no TTL, -2 if key doesn't exist
   */
  async ttl(key: string): Promise<number> {
    try {
      return await redisClient.ttl(key);
    } catch (error) {
      logger.error(`[CacheService] Error getting TTL for key ${key}:`, error);
      return -2;
    }
  }

  // ============================================
  // DID DOCUMENT CACHING
  // ============================================

  /**
   * Build DID Document cache key
   */
  private buildDIDKey(did: string): string {
    return `${CACHE_PREFIX.DID_DOCUMENT}${did}`;
  }

  /**
   * Get DID Document from cache
   * @param did - DID string
   * @returns Cached DID document or null
   */
  async getDIDDocument(did: string): Promise<CachedDIDDocument | null> {
    const key = this.buildDIDKey(did);
    const cached = await this.get<CachedDIDDocument>(key);

    if (cached) {
      logger.debug(`[CacheService] Cache HIT for DID Document: ${did}`);
    } else {
      logger.debug(`[CacheService] Cache MISS for DID Document: ${did}`);
    }

    return cached;
  }

  /**
   * Cache DID Document
   * @param did - DID string
   * @param document - DID document to cache
   */
  async setDIDDocument(did: string, document: CachedDIDDocument): Promise<void> {
    const key = this.buildDIDKey(did);
    await this.set(key, document, CACHE_TTL.DID_DOCUMENT);
    logger.info(`[CacheService] Cached DID Document: ${did}`);
  }

  /**
   * Invalidate DID Document cache
   * @param did - DID string
   */
  async invalidateDID(did: string): Promise<void> {
    const key = this.buildDIDKey(did);
    await this.delete(key);
    logger.info(`[CacheService] Invalidated DID Document cache: ${did}`);
  }

  /**
   * Invalidate all DID Document caches
   */
  async invalidateAllDIDs(): Promise<void> {
    await this.deletePattern(`${CACHE_PREFIX.DID_DOCUMENT}*`);
    logger.info('[CacheService] Invalidated all DID Document caches');
  }

  // ============================================
  // VC SCHEMA CACHING
  // ============================================

  /**
   * Build Schema cache key
   */
  private buildSchemaKey(schemaId: string, version: number): string {
    return `${CACHE_PREFIX.VC_SCHEMA}${schemaId}:v${version}`;
  }

  /**
   * Build Schema list cache key (by issuer)
   */
  private buildSchemaListKey(issuerDid?: string): string {
    return issuerDid
      ? `${CACHE_PREFIX.VC_SCHEMA}list:issuer:${issuerDid}`
      : `${CACHE_PREFIX.VC_SCHEMA}list:all`;
  }

  /**
   * Get Schema from cache
   * @param schemaId - Schema ID
   * @param version - Schema version
   * @returns Cached schema or null
   */
  async getSchema(schemaId: string, version: number): Promise<CachedSchema | null> {
    const key = this.buildSchemaKey(schemaId, version);
    const cached = await this.get<CachedSchema>(key);

    if (cached) {
      logger.debug(`[CacheService] Cache HIT for Schema: ${schemaId} v${version}`);
    } else {
      logger.debug(`[CacheService] Cache MISS for Schema: ${schemaId} v${version}`);
    }

    return cached;
  }

  /**
   * Cache Schema
   * @param schemaId - Schema ID
   * @param version - Schema version
   * @param schema - Schema to cache
   */
  async setSchema(schemaId: string, version: number, schema: CachedSchema): Promise<void> {
    const key = this.buildSchemaKey(schemaId, version);
    await this.set(key, schema, CACHE_TTL.VC_SCHEMA);
    logger.info(`[CacheService] Cached Schema: ${schemaId} v${version}`);
  }

  /**
   * Get Schema list from cache
   * @param issuerDid - Optional issuer DID to filter
   * @returns Cached schema list or null
   */
  async getSchemaList(issuerDid?: string): Promise<CachedSchema[] | null> {
    const key = this.buildSchemaListKey(issuerDid);
    return await this.get<CachedSchema[]>(key);
  }

  /**
   * Cache Schema list
   * @param schemas - Schemas to cache
   * @param issuerDid - Optional issuer DID
   */
  async setSchemaList(schemas: CachedSchema[], issuerDid?: string): Promise<void> {
    const key = this.buildSchemaListKey(issuerDid);
    await this.set(key, schemas, CACHE_TTL.VC_SCHEMA);
    logger.info(`[CacheService] Cached Schema list${issuerDid ? ` for issuer: ${issuerDid}` : ''}`);
  }

  /**
   * Invalidate Schema cache
   * @param schemaId - Schema ID
   */
  async invalidateSchema(schemaId: string): Promise<void> {
    // Delete all versions of this schema
    await this.deletePattern(`${CACHE_PREFIX.VC_SCHEMA}${schemaId}:*`);
    // Also invalidate schema lists
    await this.deletePattern(`${CACHE_PREFIX.VC_SCHEMA}list:*`);
    logger.info(`[CacheService] Invalidated Schema cache: ${schemaId}`);
  }

  /**
   * Invalidate all Schema caches
   */
  async invalidateAllSchemas(): Promise<void> {
    await this.deletePattern(`${CACHE_PREFIX.VC_SCHEMA}*`);
    logger.info('[CacheService] Invalidated all Schema caches');
  }

  // ============================================
  // INSTITUTION CACHING
  // ============================================

  /**
   * Build Institution cache key
   */
  private buildInstitutionKey(did: string): string {
    return `${CACHE_PREFIX.INSTITUTION}${did}`;
  }

  /**
   * Build Institution list cache key
   */
  private buildInstitutionListKey(page: number, limit: number, search?: string): string {
    const searchPart = search ? `:search:${search}` : '';
    return `${CACHE_PREFIX.INSTITUTION}list:p${page}:l${limit}${searchPart}`;
  }

  /**
   * Get Institution from cache
   * @param did - Institution DID
   * @returns Cached institution or null
   */
  async getInstitution(did: string): Promise<CachedInstitution | null> {
    const key = this.buildInstitutionKey(did);
    const cached = await this.get<CachedInstitution>(key);

    if (cached) {
      logger.debug(`[CacheService] Cache HIT for Institution: ${did}`);
    } else {
      logger.debug(`[CacheService] Cache MISS for Institution: ${did}`);
    }

    return cached;
  }

  /**
   * Cache Institution
   * @param did - Institution DID
   * @param institution - Institution to cache
   */
  async setInstitution(did: string, institution: CachedInstitution): Promise<void> {
    const key = this.buildInstitutionKey(did);
    await this.set(key, institution, CACHE_TTL.INSTITUTION_METADATA);
    logger.info(`[CacheService] Cached Institution: ${did}`);
  }

  /**
   * Invalidate Institution cache
   * @param did - Institution DID
   */
  async invalidateInstitution(did: string): Promise<void> {
    const key = this.buildInstitutionKey(did);
    await this.delete(key);
    // Also invalidate institution lists
    await this.deletePattern(`${CACHE_PREFIX.INSTITUTION}list:*`);
    logger.info(`[CacheService] Invalidated Institution cache: ${did}`);
  }

  /**
   * Invalidate all Institution caches
   */
  async invalidateAllInstitutions(): Promise<void> {
    await this.deletePattern(`${CACHE_PREFIX.INSTITUTION}*`);
    logger.info('[CacheService] Invalidated all Institution caches');
  }

  // ============================================
  // ISSUER LIST CACHING
  // ============================================

  /**
   * Build Issuer list cache key
   */
  private buildIssuerListKey(filters?: string): string {
    return filters
      ? `${CACHE_PREFIX.ISSUER_LIST}${filters}`
      : `${CACHE_PREFIX.ISSUER_LIST}all`;
  }

  /**
   * Get Issuer list from cache
   * @param filters - Optional filter string for cache key
   * @returns Cached issuer list or null
   */
  async getIssuerList<T>(filters?: string): Promise<T[] | null> {
    const key = this.buildIssuerListKey(filters);
    return await this.get<T[]>(key);
  }

  /**
   * Cache Issuer list
   * @param issuers - Issuers to cache
   * @param filters - Optional filter string for cache key
   */
  async setIssuerList<T>(issuers: T[], filters?: string): Promise<void> {
    const key = this.buildIssuerListKey(filters);
    await this.set(key, issuers, CACHE_TTL.ISSUER_LIST);
    logger.info('[CacheService] Cached Issuer list');
  }

  /**
   * Invalidate all Issuer list caches
   */
  async invalidateIssuerLists(): Promise<void> {
    await this.deletePattern(`${CACHE_PREFIX.ISSUER_LIST}*`);
    logger.info('[CacheService] Invalidated all Issuer list caches');
  }

  // ============================================
  // UTILITY METHODS
  // ============================================

  /**
   * Flush all cache entries
   * WARNING: This will clear ALL Redis data
   */
  async flushAll(): Promise<void> {
    try {
      await redisClient.flushdb();
      logger.warn('[CacheService] Flushed all cache entries');
    } catch (error) {
      logger.error('[CacheService] Error flushing cache:', error);
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    keys: number;
    memory: string;
    uptime: number;
  }> {
    try {
      const info = await redisClient.info('memory');
      const dbSize = await redisClient.dbsize();
      const serverInfo = await redisClient.info('server');

      // Parse memory usage
      const memoryMatch = info.match(/used_memory_human:(\S+)/);
      const memory = memoryMatch ? memoryMatch[1] : 'unknown';

      // Parse uptime
      const uptimeMatch = serverInfo.match(/uptime_in_seconds:(\d+)/);
      const uptime = uptimeMatch ? parseInt(uptimeMatch[1], 10) : 0;

      return {
        keys: dbSize,
        memory,
        uptime,
      };
    } catch (error) {
      logger.error('[CacheService] Error getting stats:', error);
      return {
        keys: 0,
        memory: 'unknown',
        uptime: 0,
      };
    }
  }

  /**
   * Check cache health
   */
  async isHealthy(): Promise<boolean> {
    try {
      const pong = await redisClient.ping();
      return pong === 'PONG';
    } catch {
      return false;
    }
  }
}

// Export singleton instance
const cacheService = new CacheService();
export default cacheService;

// Export class for testing
export { CacheService };
