/**
 * Distributed Lock Service Tests
 * Tests for distributed locking and leader election
 * Task: A2.1, A2.2 - Create distributed lock service with Redlock
 */

import { mockRedisClient, clearMockRedis, getMockStorage } from '../mocks/redis.mock';
import { mockLogger, clearMockLogger } from '../mocks/logger.mock';

// Mock Redis and Logger before importing
jest.mock('../../config/redis', () => ({
  __esModule: true,
  default: mockRedisClient,
}));

jest.mock('../../config/logger', () => ({
  __esModule: true,
  default: mockLogger,
}));

// Mock uuid
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-uuid-1234'),
}));

// Import after mocking
import distributedLockService, {
  DistributedLockService,
  LOCK_CONFIG,
  Lock,
} from '../../services/distributedLock.service';

describe('DistributedLockService', () => {
  beforeEach(() => {
    clearMockRedis();
    clearMockLogger();
    jest.clearAllMocks();
  });

  // ===========================================
  // CONFIGURATION TESTS
  // ===========================================
  describe('Configuration', () => {
    it('should have correct default TTL', () => {
      expect(LOCK_CONFIG.DEFAULT_TTL_MS).toBe(30000);
    });

    it('should have correct retry settings', () => {
      expect(LOCK_CONFIG.RETRY_DELAY_MS).toBe(200);
      expect(LOCK_CONFIG.MAX_RETRIES).toBe(10);
    });

    it('should have correct leader election settings', () => {
      expect(LOCK_CONFIG.HEARTBEAT_INTERVAL_MS).toBe(10000);
      expect(LOCK_CONFIG.LEADER_TIMEOUT_MS).toBe(30000);
    });

    it('should have correct prefixes', () => {
      expect(LOCK_CONFIG.LOCK_PREFIX).toBe('lock:');
      expect(LOCK_CONFIG.LEADER_PREFIX).toBe('leader:');
    });
  });

  // ===========================================
  // INSTANCE ID TESTS
  // ===========================================
  describe('Instance ID', () => {
    it('should generate unique instance ID', () => {
      const instanceId = distributedLockService.getInstanceId();
      expect(instanceId).toBeDefined();
      expect(instanceId).toContain('instance:');
    });
  });

  // ===========================================
  // ACQUIRE LOCK TESTS
  // ===========================================
  describe('acquireLock()', () => {
    it('should acquire lock successfully when not held', async () => {
      mockRedisClient.set.mockResolvedValueOnce('OK');

      const lock = await distributedLockService.acquireLock('test-resource');

      expect(lock).not.toBeNull();
      expect(lock?.resource).toBe('test-resource');
      expect(lock?.expiresAt).toBeGreaterThan(Date.now());
    });

    it('should return null when lock is already held', async () => {
      mockRedisClient.set.mockResolvedValueOnce(null);

      const lock = await distributedLockService.acquireLock('held-resource');

      expect(lock).toBeNull();
    });

    it('should use correct key format', async () => {
      mockRedisClient.set.mockResolvedValueOnce('OK');

      await distributedLockService.acquireLock('my-resource');

      expect(mockRedisClient.set).toHaveBeenCalledWith(
        'lock:my-resource',
        expect.any(String),
        'EX',
        expect.any(Number),
        'NX'
      );
    });

    it('should use custom TTL when provided', async () => {
      mockRedisClient.set.mockResolvedValueOnce('OK');

      await distributedLockService.acquireLock('resource', 60000);

      expect(mockRedisClient.set).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        'EX',
        60, // 60 seconds
        'NX'
      );
    });

    it('should handle Redis errors gracefully', async () => {
      mockRedisClient.set.mockRejectedValueOnce(new Error('Redis error'));

      const lock = await distributedLockService.acquireLock('error-resource');

      expect(lock).toBeNull();
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  // ===========================================
  // ACQUIRE LOCK WITH RETRY TESTS
  // ===========================================
  describe('acquireLockWithRetry()', () => {
    it('should acquire lock on first try', async () => {
      mockRedisClient.set.mockResolvedValueOnce('OK');

      const lock = await distributedLockService.acquireLockWithRetry('resource', 30000, 3, 10);

      expect(lock).not.toBeNull();
      expect(mockRedisClient.set).toHaveBeenCalledTimes(1);
    });

    it('should retry when lock is held', async () => {
      mockRedisClient.set
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce('OK');

      const lock = await distributedLockService.acquireLockWithRetry('resource', 30000, 5, 10);

      expect(lock).not.toBeNull();
      expect(mockRedisClient.set).toHaveBeenCalledTimes(3);
    });

    it('should return null after max retries', async () => {
      mockRedisClient.set.mockResolvedValue(null);

      const lock = await distributedLockService.acquireLockWithRetry('resource', 30000, 3, 10);

      expect(lock).toBeNull();
      expect(mockRedisClient.set).toHaveBeenCalledTimes(3);
      expect(mockLogger.warn).toHaveBeenCalled();
    });
  });

  // ===========================================
  // RELEASE LOCK TESTS
  // ===========================================
  describe('releaseLock()', () => {
    it('should release lock successfully', async () => {
      mockRedisClient.eval.mockResolvedValueOnce(1);

      const lock: Lock = {
        resource: 'test-resource',
        value: 'test-value',
        expiresAt: Date.now() + 30000,
      };

      const released = await distributedLockService.releaseLock(lock);

      expect(released).toBe(true);
      expect(mockRedisClient.eval).toHaveBeenCalled();
    });

    it('should return false when lock is not owned', async () => {
      mockRedisClient.eval.mockResolvedValueOnce(0);

      const lock: Lock = {
        resource: 'other-resource',
        value: 'wrong-value',
        expiresAt: Date.now() + 30000,
      };

      const released = await distributedLockService.releaseLock(lock);

      expect(released).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('should handle Redis errors gracefully', async () => {
      mockRedisClient.eval.mockRejectedValueOnce(new Error('Redis error'));

      const lock: Lock = {
        resource: 'error-resource',
        value: 'test-value',
        expiresAt: Date.now() + 30000,
      };

      const released = await distributedLockService.releaseLock(lock);

      expect(released).toBe(false);
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  // ===========================================
  // EXTEND LOCK TESTS
  // ===========================================
  describe('extendLock()', () => {
    it('should extend lock successfully', async () => {
      mockRedisClient.eval.mockResolvedValueOnce(1);

      const lock: Lock = {
        resource: 'test-resource',
        value: 'test-value',
        expiresAt: Date.now() + 30000,
      };

      const extended = await distributedLockService.extendLock(lock, 60000);

      expect(extended).toBe(true);
      expect(lock.expiresAt).toBeGreaterThan(Date.now() + 50000);
    });

    it('should return false when lock is not owned', async () => {
      mockRedisClient.eval.mockResolvedValueOnce(0);

      const lock: Lock = {
        resource: 'other-resource',
        value: 'wrong-value',
        expiresAt: Date.now() + 30000,
      };

      const extended = await distributedLockService.extendLock(lock, 60000);

      expect(extended).toBe(false);
    });
  });

  // ===========================================
  // IS LOCKED TESTS
  // ===========================================
  describe('isLocked()', () => {
    it('should return true when resource is locked', async () => {
      mockRedisClient.exists.mockResolvedValueOnce(1);

      const result = await distributedLockService.isLocked('locked-resource');

      expect(result).toBe(true);
    });

    it('should return false when resource is not locked', async () => {
      mockRedisClient.exists.mockResolvedValueOnce(0);

      const result = await distributedLockService.isLocked('unlocked-resource');

      expect(result).toBe(false);
    });
  });

  // ===========================================
  // LEADER ELECTION TESTS
  // ===========================================
  describe('electLeader()', () => {
    it('should become leader when no current leader', async () => {
      mockRedisClient.set.mockResolvedValueOnce('OK');

      const isLeader = await distributedLockService.electLeader('test-worker');

      expect(isLeader).toBe(true);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Elected as leader')
      );
    });

    it('should return false when another instance is leader', async () => {
      mockRedisClient.set.mockResolvedValueOnce(null);
      mockRedisClient.get.mockResolvedValueOnce('other-instance-id');

      const isLeader = await distributedLockService.electLeader('test-worker');

      expect(isLeader).toBe(false);
    });

    it('should refresh leadership if already leader', async () => {
      const instanceId = distributedLockService.getInstanceId();
      mockRedisClient.set.mockResolvedValueOnce(null);
      mockRedisClient.get.mockResolvedValueOnce(instanceId);
      mockRedisClient.expire.mockResolvedValueOnce(1);

      const isLeader = await distributedLockService.electLeader('test-worker');

      expect(isLeader).toBe(true);
    });
  });

  // ===========================================
  // IS LEADER TESTS
  // ===========================================
  describe('isLeader()', () => {
    it('should return true when this instance is leader', async () => {
      const instanceId = distributedLockService.getInstanceId();
      mockRedisClient.get.mockResolvedValueOnce(instanceId);

      const result = await distributedLockService.isLeader('test-worker');

      expect(result).toBe(true);
    });

    it('should return false when another instance is leader', async () => {
      mockRedisClient.get.mockResolvedValueOnce('other-instance');

      const result = await distributedLockService.isLeader('test-worker');

      expect(result).toBe(false);
    });

    it('should return false when no leader exists', async () => {
      mockRedisClient.get.mockResolvedValueOnce(null);

      const result = await distributedLockService.isLeader('test-worker');

      expect(result).toBe(false);
    });
  });

  // ===========================================
  // GET LEADER INFO TESTS
  // ===========================================
  describe('getLeaderInfo()', () => {
    it('should return leader info when leader exists', async () => {
      mockRedisClient.get.mockResolvedValueOnce('leader-instance');
      mockRedisClient.ttl.mockResolvedValueOnce(25);

      const info = await distributedLockService.getLeaderInfo('test-worker');

      expect(info).not.toBeNull();
      expect(info?.leaderId).toBe('leader-instance');
      expect(info?.isLeader).toBe(false);
    });

    it('should return null when no leader', async () => {
      mockRedisClient.get.mockResolvedValueOnce(null);
      mockRedisClient.ttl.mockResolvedValueOnce(-2);

      const info = await distributedLockService.getLeaderInfo('test-worker');

      expect(info).toBeNull();
    });
  });

  // ===========================================
  // HEARTBEAT TESTS
  // ===========================================
  describe('heartbeat()', () => {
    it('should extend leadership when still leader', async () => {
      mockRedisClient.eval.mockResolvedValueOnce(1);

      await distributedLockService.heartbeat('test-worker');

      expect(mockRedisClient.eval).toHaveBeenCalled();
    });

    it('should log warning when no longer leader', async () => {
      mockRedisClient.eval.mockResolvedValueOnce(0);

      await distributedLockService.heartbeat('test-worker');

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Lost leadership')
      );
    });
  });

  // ===========================================
  // RESIGN LEADERSHIP TESTS
  // ===========================================
  describe('resignLeadership()', () => {
    it('should resign leadership successfully', async () => {
      mockRedisClient.eval.mockResolvedValueOnce(1);

      await distributedLockService.resignLeadership('test-worker');

      expect(mockRedisClient.eval).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Resigned leadership')
      );
    });
  });

  // ===========================================
  // RESOURCE-SPECIFIC LOCKS TESTS
  // ===========================================
  describe('Resource-Specific Locks', () => {
    beforeEach(() => {
      mockRedisClient.set.mockResolvedValue('OK');
    });

    it('should lock DID registration', async () => {
      const lock = await distributedLockService.lockDIDRegistration('did:test:123');

      expect(lock).not.toBeNull();
      expect(mockRedisClient.set).toHaveBeenCalledWith(
        'lock:did:register:did:test:123',
        expect.any(String),
        'EX',
        60,
        'NX'
      );
    });

    it('should lock DID key rotation', async () => {
      const lock = await distributedLockService.lockDIDKeyRotation('did:test:123');

      expect(lock).not.toBeNull();
      expect(mockRedisClient.set).toHaveBeenCalledWith(
        'lock:did:rotate:did:test:123',
        expect.any(String),
        'EX',
        60,
        'NX'
      );
    });

    it('should lock VC issuance', async () => {
      const lock = await distributedLockService.lockVCIssuance('vc-123');

      expect(lock).not.toBeNull();
      expect(mockRedisClient.set).toHaveBeenCalledWith(
        'lock:vc:issue:vc-123',
        expect.any(String),
        'EX',
        60,
        'NX'
      );
    });

    it('should lock VC revocation', async () => {
      const lock = await distributedLockService.lockVCRevocation('vc-123');

      expect(lock).not.toBeNull();
      expect(mockRedisClient.set).toHaveBeenCalledWith(
        'lock:vc:revoke:vc-123',
        expect.any(String),
        'EX',
        60,
        'NX'
      );
    });

    it('should lock schema modification', async () => {
      const lock = await distributedLockService.lockSchemaModification('schema-123');

      expect(lock).not.toBeNull();
      expect(mockRedisClient.set).toHaveBeenCalledWith(
        'lock:schema:modify:schema-123',
        expect.any(String),
        'EX',
        60,
        'NX'
      );
    });

    it('should lock blockchain transaction with longer TTL', async () => {
      const lock = await distributedLockService.lockBlockchainTransaction('tx-123');

      expect(lock).not.toBeNull();
      expect(mockRedisClient.set).toHaveBeenCalledWith(
        'lock:tx:process:tx-123',
        expect.any(String),
        'EX',
        120, // 2 minutes for blockchain transactions
        'NX'
      );
    });

    it('should lock payment processing', async () => {
      const lock = await distributedLockService.lockPaymentProcessing('payment-123');

      expect(lock).not.toBeNull();
      expect(mockRedisClient.set).toHaveBeenCalledWith(
        'lock:payment:process:payment-123',
        expect.any(String),
        'EX',
        60,
        'NX'
      );
    });

    it('should lock batch operation with extended TTL', async () => {
      const lock = await distributedLockService.lockBatchOperation('batch-123');

      expect(lock).not.toBeNull();
      expect(mockRedisClient.set).toHaveBeenCalledWith(
        'lock:batch:process:batch-123',
        expect.any(String),
        'EX',
        300, // 5 minutes for batch operations
        'NX'
      );
    });
  });

  // ===========================================
  // WITH LOCK UTILITY TESTS
  // ===========================================
  describe('withLock()', () => {
    it('should execute function with lock and release', async () => {
      mockRedisClient.set.mockResolvedValueOnce('OK');
      mockRedisClient.eval.mockResolvedValueOnce(1);

      let executed = false;
      const result = await distributedLockService.withLock('resource', async () => {
        executed = true;
        return 'success';
      });

      expect(executed).toBe(true);
      expect(result).toBe('success');
      expect(mockRedisClient.eval).toHaveBeenCalled(); // release lock
    });

    it('should release lock even when function throws', async () => {
      mockRedisClient.set.mockResolvedValueOnce('OK');
      mockRedisClient.eval.mockResolvedValueOnce(1);

      await expect(
        distributedLockService.withLock('resource', async () => {
          throw new Error('Function error');
        })
      ).rejects.toThrow('Function error');

      expect(mockRedisClient.eval).toHaveBeenCalled(); // release lock
    });

    it('should throw when lock cannot be acquired', async () => {
      mockRedisClient.set.mockResolvedValue(null);

      await expect(
        distributedLockService.withLock('locked-resource', async () => 'result', 30000)
      ).rejects.toThrow('Failed to acquire lock');
    });
  });

  // ===========================================
  // CLEANUP TESTS
  // ===========================================
  describe('cleanup()', () => {
    it('should cleanup without errors', async () => {
      mockRedisClient.eval.mockResolvedValue(1);

      await expect(distributedLockService.cleanup()).resolves.not.toThrow();

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Cleanup complete')
      );
    });
  });
});
