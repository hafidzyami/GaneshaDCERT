/**
 * Cache Service Integration Tests
 * Tests for Redis-based caching functionality
 * Task: A1.8 - Integration testing for cache service
 */

import { mockRedisClient, clearMockRedis, getMockStorage, getMockCalls } from '../mocks/redis.mock';
import { mockLogger, clearMockLogger } from '../mocks/logger.mock';

// Mock the Redis client and logger before importing the cache service
jest.mock('../../config/redis', () => ({
  __esModule: true,
  default: mockRedisClient,
}));

jest.mock('../../config/logger', () => ({
  __esModule: true,
  default: mockLogger,
}));

// Import after mocking
import CacheService, {
  CacheService as CacheServiceClass,
  CACHE_TTL,
  CACHE_PREFIX,
  CachedDIDDocument,
  CachedSchema,
  CachedInstitution,
} from '../../services/cache.service';

describe('CacheService', () => {
  beforeEach(() => {
    // Clear mocks before each test
    clearMockRedis();
    clearMockLogger();
    jest.clearAllMocks();
  });

  // ===========================================
  // CACHE TTL CONFIGURATION TESTS
  // ===========================================
  describe('Cache TTL Configuration', () => {
    it('should have correct TTL values for DID Documents (1 hour)', () => {
      expect(CACHE_TTL.DID_DOCUMENT).toBe(3600);
    });

    it('should have correct TTL values for VC Schemas (24 hours)', () => {
      expect(CACHE_TTL.VC_SCHEMA).toBe(86400);
    });

    it('should have correct TTL values for Institution Metadata (1 hour)', () => {
      expect(CACHE_TTL.INSTITUTION_METADATA).toBe(3600);
    });

    it('should have correct TTL values for Issuer List (15 minutes)', () => {
      expect(CACHE_TTL.ISSUER_LIST).toBe(900);
    });
  });

  // ===========================================
  // CACHE PREFIX CONFIGURATION TESTS
  // ===========================================
  describe('Cache Prefix Configuration', () => {
    it('should have correct prefix for DID Documents', () => {
      expect(CACHE_PREFIX.DID_DOCUMENT).toBe('did:doc:');
    });

    it('should have correct prefix for VC Schemas', () => {
      expect(CACHE_PREFIX.VC_SCHEMA).toBe('schema:');
    });

    it('should have correct prefix for Institutions', () => {
      expect(CACHE_PREFIX.INSTITUTION).toBe('institution:');
    });

    it('should have correct prefix for Issuer List', () => {
      expect(CACHE_PREFIX.ISSUER_LIST).toBe('issuers:');
    });
  });

  // ===========================================
  // GENERIC CACHE METHODS TESTS
  // ===========================================
  describe('Generic Cache Methods', () => {
    describe('get()', () => {
      it('should return null for non-existent key', async () => {
        const result = await CacheService.get('non-existent-key');
        expect(result).toBeNull();
      });

      it('should return parsed JSON value for existing key', async () => {
        const testData = { foo: 'bar', count: 42 };
        await CacheService.set('test-key', testData);

        const result = await CacheService.get('test-key');
        expect(result).toEqual(testData);
      });

      it('should handle Redis errors gracefully', async () => {
        mockRedisClient.get.mockRejectedValueOnce(new Error('Redis connection error'));

        const result = await CacheService.get('error-key');
        expect(result).toBeNull();
        expect(mockLogger.error).toHaveBeenCalled();
      });
    });

    describe('set()', () => {
      it('should set value without TTL', async () => {
        await CacheService.set('no-ttl-key', { data: 'test' });

        expect(mockRedisClient.set).toHaveBeenCalled();
        expect(getMockStorage().has('no-ttl-key')).toBe(true);
      });

      it('should set value with TTL using setex', async () => {
        await CacheService.set('ttl-key', { data: 'test' }, 3600);

        expect(mockRedisClient.setex).toHaveBeenCalledWith(
          'ttl-key',
          3600,
          JSON.stringify({ data: 'test' })
        );
      });

      it('should handle Redis errors gracefully', async () => {
        mockRedisClient.set.mockRejectedValueOnce(new Error('Redis connection error'));

        // Should not throw
        await expect(CacheService.set('error-key', { data: 'test' })).resolves.not.toThrow();
        expect(mockLogger.error).toHaveBeenCalled();
      });
    });

    describe('delete()', () => {
      it('should delete existing key', async () => {
        await CacheService.set('to-delete', { data: 'test' });
        await CacheService.delete('to-delete');

        expect(mockRedisClient.del).toHaveBeenCalledWith('to-delete');
        expect(getMockStorage().has('to-delete')).toBe(false);
      });

      it('should handle Redis errors gracefully', async () => {
        mockRedisClient.del.mockRejectedValueOnce(new Error('Redis connection error'));

        await expect(CacheService.delete('error-key')).resolves.not.toThrow();
        expect(mockLogger.error).toHaveBeenCalled();
      });
    });

    describe('deletePattern()', () => {
      it('should delete all keys matching pattern', async () => {
        // Set up test data with pattern
        await CacheService.set('pattern:1', { id: 1 });
        await CacheService.set('pattern:2', { id: 2 });
        await CacheService.set('other:1', { id: 3 });

        await CacheService.deletePattern('pattern:*');

        const storage = getMockStorage();
        expect(storage.has('pattern:1')).toBe(false);
        expect(storage.has('pattern:2')).toBe(false);
        expect(storage.has('other:1')).toBe(true);
      });
    });

    describe('exists()', () => {
      it('should return true for existing key', async () => {
        await CacheService.set('exists-key', { data: 'test' });

        const result = await CacheService.exists('exists-key');
        expect(result).toBe(true);
      });

      it('should return false for non-existent key', async () => {
        const result = await CacheService.exists('non-existent');
        expect(result).toBe(false);
      });
    });

    describe('ttl()', () => {
      it('should return remaining TTL for key with expiry', async () => {
        await CacheService.set('ttl-test', { data: 'test' }, 3600);

        const result = await CacheService.ttl('ttl-test');
        expect(result).toBeGreaterThan(0);
        expect(result).toBeLessThanOrEqual(3600);
      });

      it('should return -2 for non-existent key', async () => {
        const result = await CacheService.ttl('non-existent');
        expect(result).toBe(-2);
      });
    });
  });

  // ===========================================
  // DID DOCUMENT CACHING TESTS
  // ===========================================
  describe('DID Document Caching', () => {
    const testDID = 'did:dcert:u:test123';
    const testDocument: CachedDIDDocument = {
      found: true,
      status: 'Active',
      keyId: 'key-1',
      didDocument: {
        '@context': ['https://www.w3.org/ns/did/v1.1'],
        id: testDID,
        verificationMethod: [],
      },
      didDocumentMetadata: {},
      didResolutionMetadata: {},
    };

    describe('getDIDDocument()', () => {
      it('should return null for non-cached DID', async () => {
        const result = await CacheService.getDIDDocument(testDID);
        expect(result).toBeNull();
      });

      it('should return cached DID document', async () => {
        await CacheService.setDIDDocument(testDID, testDocument);

        const result = await CacheService.getDIDDocument(testDID);
        expect(result).toEqual(testDocument);
      });

      it('should use correct cache key format', async () => {
        await CacheService.getDIDDocument(testDID);

        expect(mockRedisClient.get).toHaveBeenCalledWith(`${CACHE_PREFIX.DID_DOCUMENT}${testDID}`);
      });
    });

    describe('setDIDDocument()', () => {
      it('should cache DID document with correct TTL', async () => {
        await CacheService.setDIDDocument(testDID, testDocument);

        expect(mockRedisClient.setex).toHaveBeenCalledWith(
          `${CACHE_PREFIX.DID_DOCUMENT}${testDID}`,
          CACHE_TTL.DID_DOCUMENT,
          JSON.stringify(testDocument)
        );
      });

      it('should log caching action', async () => {
        await CacheService.setDIDDocument(testDID, testDocument);

        expect(mockLogger.info).toHaveBeenCalledWith(
          expect.stringContaining('Cached DID Document')
        );
      });
    });

    describe('invalidateDID()', () => {
      it('should delete cached DID document', async () => {
        await CacheService.setDIDDocument(testDID, testDocument);
        await CacheService.invalidateDID(testDID);

        const result = await CacheService.getDIDDocument(testDID);
        expect(result).toBeNull();
      });

      it('should log invalidation action', async () => {
        await CacheService.invalidateDID(testDID);

        expect(mockLogger.info).toHaveBeenCalledWith(
          expect.stringContaining('Invalidated DID Document cache')
        );
      });
    });

    describe('invalidateAllDIDs()', () => {
      it('should delete all DID document caches', async () => {
        await CacheService.setDIDDocument('did:1', testDocument);
        await CacheService.setDIDDocument('did:2', testDocument);

        await CacheService.invalidateAllDIDs();

        // Verify deletePattern was called with correct pattern
        expect(mockRedisClient.scan).toHaveBeenCalled();
      });
    });
  });

  // ===========================================
  // VC SCHEMA CACHING TESTS
  // ===========================================
  describe('VC Schema Caching', () => {
    const testSchemaId = 'schema-123';
    const testVersion = 1;
    const testSchema: CachedSchema = {
      id: testSchemaId,
      version: testVersion,
      name: 'Test Certificate',
      issuer_did: 'did:dcert:i:issuer123',
      schema: { fields: ['name', 'date'] },
      isActive: true,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    };

    describe('getSchema()', () => {
      it('should return null for non-cached schema', async () => {
        const result = await CacheService.getSchema(testSchemaId, testVersion);
        expect(result).toBeNull();
      });

      it('should return cached schema', async () => {
        await CacheService.setSchema(testSchemaId, testVersion, testSchema);

        const result = await CacheService.getSchema(testSchemaId, testVersion);
        expect(result).toEqual(testSchema);
      });

      it('should use correct cache key format with version', async () => {
        await CacheService.getSchema(testSchemaId, testVersion);

        expect(mockRedisClient.get).toHaveBeenCalledWith(
          `${CACHE_PREFIX.VC_SCHEMA}${testSchemaId}:v${testVersion}`
        );
      });
    });

    describe('setSchema()', () => {
      it('should cache schema with correct TTL', async () => {
        await CacheService.setSchema(testSchemaId, testVersion, testSchema);

        expect(mockRedisClient.setex).toHaveBeenCalledWith(
          `${CACHE_PREFIX.VC_SCHEMA}${testSchemaId}:v${testVersion}`,
          CACHE_TTL.VC_SCHEMA,
          JSON.stringify(testSchema)
        );
      });
    });

    describe('getSchemaList() / setSchemaList()', () => {
      it('should cache and retrieve schema list', async () => {
        const schemas = [testSchema];

        await CacheService.setSchemaList(schemas);
        const result = await CacheService.getSchemaList();

        expect(result).toEqual(schemas);
      });

      it('should support issuer-specific schema lists', async () => {
        const issuerDid = 'did:dcert:i:issuer123';
        const schemas = [testSchema];

        await CacheService.setSchemaList(schemas, issuerDid);
        const result = await CacheService.getSchemaList(issuerDid);

        expect(result).toEqual(schemas);
      });
    });

    describe('invalidateSchema()', () => {
      it('should delete all versions of a schema', async () => {
        await CacheService.setSchema(testSchemaId, 1, testSchema);
        await CacheService.setSchema(testSchemaId, 2, { ...testSchema, version: 2 });

        await CacheService.invalidateSchema(testSchemaId);

        // Verify pattern deletion was called
        expect(mockRedisClient.scan).toHaveBeenCalled();
      });

      it('should also invalidate schema lists', async () => {
        await CacheService.invalidateSchema(testSchemaId);

        // Should call scan at least twice (for schema versions and lists)
        expect(mockRedisClient.scan.mock.calls.length).toBeGreaterThanOrEqual(1);
      });
    });
  });

  // ===========================================
  // INSTITUTION CACHING TESTS
  // ===========================================
  describe('Institution Caching', () => {
    const testInstitutionDid = 'did:dcert:i:institution123';
    const testInstitution: CachedInstitution = {
      id: 'inst-uuid-123',
      did: testInstitutionDid,
      name: 'Test University',
      email: 'admin@test.edu',
      phone: '+1234567890',
      country: 'Indonesia',
      website: 'https://test.edu',
      address: '123 Test Street',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    };

    describe('getInstitution()', () => {
      it('should return null for non-cached institution', async () => {
        const result = await CacheService.getInstitution(testInstitutionDid);
        expect(result).toBeNull();
      });

      it('should return cached institution', async () => {
        await CacheService.setInstitution(testInstitutionDid, testInstitution);

        const result = await CacheService.getInstitution(testInstitutionDid);
        expect(result).toEqual(testInstitution);
      });

      it('should use correct cache key format', async () => {
        await CacheService.getInstitution(testInstitutionDid);

        expect(mockRedisClient.get).toHaveBeenCalledWith(
          `${CACHE_PREFIX.INSTITUTION}${testInstitutionDid}`
        );
      });
    });

    describe('setInstitution()', () => {
      it('should cache institution with correct TTL', async () => {
        await CacheService.setInstitution(testInstitutionDid, testInstitution);

        expect(mockRedisClient.setex).toHaveBeenCalledWith(
          `${CACHE_PREFIX.INSTITUTION}${testInstitutionDid}`,
          CACHE_TTL.INSTITUTION_METADATA,
          JSON.stringify(testInstitution)
        );
      });
    });

    describe('invalidateInstitution()', () => {
      it('should delete cached institution', async () => {
        await CacheService.setInstitution(testInstitutionDid, testInstitution);
        await CacheService.invalidateInstitution(testInstitutionDid);

        const result = await CacheService.getInstitution(testInstitutionDid);
        expect(result).toBeNull();
      });

      it('should also invalidate institution lists', async () => {
        await CacheService.invalidateInstitution(testInstitutionDid);

        // Verify pattern deletion for lists
        expect(mockRedisClient.scan).toHaveBeenCalled();
      });
    });

    describe('invalidateAllInstitutions()', () => {
      it('should delete all institution caches', async () => {
        await CacheService.setInstitution('did:1', testInstitution);
        await CacheService.setInstitution('did:2', testInstitution);

        await CacheService.invalidateAllInstitutions();

        expect(mockRedisClient.scan).toHaveBeenCalled();
      });
    });
  });

  // ===========================================
  // ISSUER LIST CACHING TESTS
  // ===========================================
  describe('Issuer List Caching', () => {
    const testIssuers = [
      { did: 'did:1', name: 'Issuer 1' },
      { did: 'did:2', name: 'Issuer 2' },
    ];

    describe('getIssuerList() / setIssuerList()', () => {
      it('should cache and retrieve issuer list', async () => {
        await CacheService.setIssuerList(testIssuers);
        const result = await CacheService.getIssuerList();

        expect(result).toEqual(testIssuers);
      });

      it('should support filtered issuer lists', async () => {
        const filters = 'country:Indonesia';

        await CacheService.setIssuerList(testIssuers, filters);
        const result = await CacheService.getIssuerList(filters);

        expect(result).toEqual(testIssuers);
      });

      it('should use correct TTL for issuer lists', async () => {
        await CacheService.setIssuerList(testIssuers);

        expect(mockRedisClient.setex).toHaveBeenCalledWith(
          expect.any(String),
          CACHE_TTL.ISSUER_LIST,
          expect.any(String)
        );
      });
    });

    describe('invalidateIssuerLists()', () => {
      it('should delete all issuer list caches', async () => {
        await CacheService.setIssuerList(testIssuers);
        await CacheService.setIssuerList(testIssuers, 'filter:test');

        await CacheService.invalidateIssuerLists();

        expect(mockRedisClient.scan).toHaveBeenCalled();
      });
    });
  });

  // ===========================================
  // UTILITY METHODS TESTS
  // ===========================================
  describe('Utility Methods', () => {
    describe('flushAll()', () => {
      it('should clear all cache entries', async () => {
        await CacheService.set('key1', { data: 1 });
        await CacheService.set('key2', { data: 2 });

        await CacheService.flushAll();

        expect(mockRedisClient.flushdb).toHaveBeenCalled();
        expect(getMockStorage().size).toBe(0);
      });

      it('should log warning when flushing', async () => {
        await CacheService.flushAll();

        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining('Flushed all cache entries')
        );
      });
    });

    describe('getStats()', () => {
      it('should return cache statistics', async () => {
        await CacheService.set('key1', { data: 1 });
        await CacheService.set('key2', { data: 2 });

        const stats = await CacheService.getStats();

        expect(stats).toHaveProperty('keys');
        expect(stats).toHaveProperty('memory');
        expect(stats).toHaveProperty('uptime');
        expect(stats.keys).toBe(2);
        expect(typeof stats.memory).toBe('string');
        expect(typeof stats.uptime).toBe('number');
      });

      it('should handle errors gracefully', async () => {
        mockRedisClient.info.mockRejectedValueOnce(new Error('Connection error'));

        const stats = await CacheService.getStats();

        expect(stats).toEqual({
          keys: 0,
          memory: 'unknown',
          uptime: 0,
        });
      });
    });

    describe('isHealthy()', () => {
      it('should return true when Redis is healthy', async () => {
        const result = await CacheService.isHealthy();
        expect(result).toBe(true);
      });

      it('should return false when Redis is not responding', async () => {
        mockRedisClient.ping.mockRejectedValueOnce(new Error('Connection refused'));

        const result = await CacheService.isHealthy();
        expect(result).toBe(false);
      });
    });
  });

  // ===========================================
  // CACHE INVALIDATION FLOW TESTS
  // ===========================================
  describe('Cache Invalidation Flows', () => {
    it('should invalidate DID cache when key rotation occurs', async () => {
      const did = 'did:dcert:u:rotation-test';
      const document: CachedDIDDocument = {
        found: true,
        keyId: 'key-1',
      };

      // Cache the DID
      await CacheService.setDIDDocument(did, document);
      expect(await CacheService.getDIDDocument(did)).toEqual(document);

      // Simulate key rotation by invalidating
      await CacheService.invalidateDID(did);

      // Cache should be empty
      expect(await CacheService.getDIDDocument(did)).toBeNull();
    });

    it('should invalidate schema cache when new version is created', async () => {
      const schemaId = 'version-test-schema';
      const v1: CachedSchema = {
        id: schemaId,
        version: 1,
        name: 'Test',
        issuer_did: 'did:test',
        schema: {},
        isActive: true,
        createdAt: '',
        updatedAt: '',
      };

      // Cache v1
      await CacheService.setSchema(schemaId, 1, v1);
      expect(await CacheService.getSchema(schemaId, 1)).toEqual(v1);

      // Simulate new version - invalidate old cache
      await CacheService.invalidateSchema(schemaId);

      // All versions should be invalidated
      expect(await CacheService.getSchema(schemaId, 1)).toBeNull();
    });

    it('should invalidate institution and lists when institution is updated', async () => {
      const did = 'did:dcert:i:update-test';
      const institution: CachedInstitution = {
        id: 'uuid',
        did,
        name: 'Test',
        email: 'test@test.com',
        createdAt: '',
        updatedAt: '',
      };

      await CacheService.setInstitution(did, institution);
      await CacheService.invalidateInstitution(did);

      expect(await CacheService.getInstitution(did)).toBeNull();
    });
  });

  // ===========================================
  // ERROR HANDLING TESTS
  // ===========================================
  describe('Error Handling', () => {
    it('should not throw on get errors', async () => {
      mockRedisClient.get.mockRejectedValueOnce(new Error('Network error'));

      await expect(CacheService.get('error-key')).resolves.toBeNull();
    });

    it('should not throw on set errors', async () => {
      mockRedisClient.setex.mockRejectedValueOnce(new Error('Network error'));

      await expect(
        CacheService.set('error-key', { data: 'test' }, 60)
      ).resolves.not.toThrow();
    });

    it('should not throw on delete errors', async () => {
      mockRedisClient.del.mockRejectedValueOnce(new Error('Network error'));

      await expect(CacheService.delete('error-key')).resolves.not.toThrow();
    });

    it('should log all errors', async () => {
      mockRedisClient.get.mockRejectedValueOnce(new Error('Test error'));

      await CacheService.get('error-key');

      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  // ===========================================
  // CONCURRENT ACCESS TESTS
  // ===========================================
  describe('Concurrent Access', () => {
    it('should handle multiple concurrent reads', async () => {
      const testData = { data: 'concurrent-test' };
      await CacheService.set('concurrent-key', testData);

      const promises = Array(10).fill(null).map(() =>
        CacheService.get('concurrent-key')
      );

      const results = await Promise.all(promises);

      results.forEach(result => {
        expect(result).toEqual(testData);
      });
    });

    it('should handle multiple concurrent writes', async () => {
      const promises = Array(10).fill(null).map((_, i) =>
        CacheService.set(`concurrent-write-${i}`, { index: i })
      );

      await Promise.all(promises);

      // Verify all writes succeeded
      for (let i = 0; i < 10; i++) {
        const result = await CacheService.get(`concurrent-write-${i}`);
        expect(result).toEqual({ index: i });
      }
    });
  });
});
