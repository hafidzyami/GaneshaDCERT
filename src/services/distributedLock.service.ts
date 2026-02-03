/**
 * Distributed Lock Service
 * Provides distributed locking for multi-instance coordination
 * Uses Redlock algorithm for reliable distributed locking
 * Task: A2.1, A2.2 - Create distributed lock service with Redlock
 */

import redisClient from '../config/redis';
import logger from '../config/logger';
import { v4 as uuidv4 } from 'uuid';

/**
 * Lock interface representing a distributed lock
 */
export interface Lock {
  resource: string;
  value: string;
  expiresAt: number;
}

/**
 * Leader election result
 */
export interface LeaderInfo {
  isLeader: boolean;
  leaderId: string;
  lastHeartbeat: number;
}

/**
 * Lock configuration
 */
export const LOCK_CONFIG = {
  // Default lock TTL in milliseconds
  DEFAULT_TTL_MS: 30000,
  // Retry delay for acquiring lock
  RETRY_DELAY_MS: 200,
  // Maximum retry attempts
  MAX_RETRIES: 10,
  // Clock drift factor (for Redlock)
  DRIFT_FACTOR: 0.01,
  // Leader election key prefix
  LEADER_PREFIX: 'leader:',
  // Lock key prefix
  LOCK_PREFIX: 'lock:',
  // Heartbeat interval for leader
  HEARTBEAT_INTERVAL_MS: 10000,
  // Leader timeout (if no heartbeat within this time, leader is considered dead)
  LEADER_TIMEOUT_MS: 30000,
} as const;

/**
 * Distributed Lock Service Class
 * Implements Redlock algorithm for distributed locking
 */
class DistributedLockService {
  private instanceId: string;
  private heartbeatIntervals: Map<string, NodeJS.Timeout> = new Map();

  constructor() {
    // Generate unique instance ID for this server instance
    this.instanceId = `instance:${uuidv4().slice(0, 8)}:${Date.now()}`;
    logger.info(`[DistributedLock] Initialized with instance ID: ${this.instanceId}`);
  }

  /**
   * Get the instance ID
   */
  getInstanceId(): string {
    return this.instanceId;
  }

  // ============================================
  // DISTRIBUTED LOCKING (Redlock Algorithm)
  // ============================================

  /**
   * Acquire a distributed lock
   * Uses Redlock algorithm for reliability
   *
   * @param resource - Resource identifier to lock
   * @param ttlMs - Time to live in milliseconds
   * @returns Lock object if acquired, null if failed
   */
  async acquireLock(resource: string, ttlMs: number = LOCK_CONFIG.DEFAULT_TTL_MS): Promise<Lock | null> {
    const lockKey = `${LOCK_CONFIG.LOCK_PREFIX}${resource}`;
    const lockValue = `${this.instanceId}:${uuidv4()}`;
    const ttlSeconds = Math.ceil(ttlMs / 1000);

    try {
      // Try to set the lock with NX (only if not exists) and EX (with expiry)
      const result = await redisClient.set(
        lockKey,
        lockValue,
        'EX',
        ttlSeconds,
        'NX'
      );

      if (result === 'OK') {
        const lock: Lock = {
          resource,
          value: lockValue,
          expiresAt: Date.now() + ttlMs,
        };
        logger.debug(`[DistributedLock] Acquired lock: ${resource}`);
        return lock;
      }

      logger.debug(`[DistributedLock] Failed to acquire lock: ${resource} (already held)`);
      return null;
    } catch (error) {
      logger.error(`[DistributedLock] Error acquiring lock ${resource}:`, error);
      return null;
    }
  }

  /**
   * Acquire a lock with retry logic
   * Will retry multiple times before giving up
   *
   * @param resource - Resource identifier to lock
   * @param ttlMs - Time to live in milliseconds
   * @param retries - Number of retry attempts
   * @param retryDelayMs - Delay between retries
   * @returns Lock object if acquired, null if all retries failed
   */
  async acquireLockWithRetry(
    resource: string,
    ttlMs: number = LOCK_CONFIG.DEFAULT_TTL_MS,
    retries: number = LOCK_CONFIG.MAX_RETRIES,
    retryDelayMs: number = LOCK_CONFIG.RETRY_DELAY_MS
  ): Promise<Lock | null> {
    for (let attempt = 0; attempt < retries; attempt++) {
      const lock = await this.acquireLock(resource, ttlMs);
      if (lock) {
        return lock;
      }

      // Wait before retrying
      if (attempt < retries - 1) {
        await this.sleep(retryDelayMs);
      }
    }

    logger.warn(`[DistributedLock] Failed to acquire lock after ${retries} retries: ${resource}`);
    return null;
  }

  /**
   * Release a distributed lock
   * Uses Lua script to ensure atomic check-and-delete
   *
   * @param lock - Lock object to release
   * @returns true if released, false if lock was already released or owned by another
   */
  async releaseLock(lock: Lock): Promise<boolean> {
    const lockKey = `${LOCK_CONFIG.LOCK_PREFIX}${lock.resource}`;

    // Lua script for atomic check-and-delete
    // Only delete if the value matches (prevents releasing someone else's lock)
    const luaScript = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;

    try {
      const result = await redisClient.eval(luaScript, 1, lockKey, lock.value);
      const released = result === 1;

      if (released) {
        logger.debug(`[DistributedLock] Released lock: ${lock.resource}`);
      } else {
        logger.warn(`[DistributedLock] Failed to release lock (not owner): ${lock.resource}`);
      }

      return released;
    } catch (error) {
      logger.error(`[DistributedLock] Error releasing lock ${lock.resource}:`, error);
      return false;
    }
  }

  /**
   * Extend a lock's TTL
   * Useful for long-running operations
   *
   * @param lock - Lock object to extend
   * @param ttlMs - New TTL in milliseconds
   * @returns true if extended, false if lock is no longer held
   */
  async extendLock(lock: Lock, ttlMs: number): Promise<boolean> {
    const lockKey = `${LOCK_CONFIG.LOCK_PREFIX}${lock.resource}`;
    const ttlSeconds = Math.ceil(ttlMs / 1000);

    // Lua script for atomic check-and-extend
    const luaScript = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("expire", KEYS[1], ARGV[2])
      else
        return 0
      end
    `;

    try {
      const result = await redisClient.eval(luaScript, 1, lockKey, lock.value, ttlSeconds);
      const extended = result === 1;

      if (extended) {
        lock.expiresAt = Date.now() + ttlMs;
        logger.debug(`[DistributedLock] Extended lock: ${lock.resource}`);
      } else {
        logger.warn(`[DistributedLock] Failed to extend lock (not owner): ${lock.resource}`);
      }

      return extended;
    } catch (error) {
      logger.error(`[DistributedLock] Error extending lock ${lock.resource}:`, error);
      return false;
    }
  }

  /**
   * Check if a resource is currently locked
   *
   * @param resource - Resource identifier
   * @returns true if locked, false otherwise
   */
  async isLocked(resource: string): Promise<boolean> {
    const lockKey = `${LOCK_CONFIG.LOCK_PREFIX}${resource}`;
    try {
      const result = await redisClient.exists(lockKey);
      return result === 1;
    } catch (error) {
      logger.error(`[DistributedLock] Error checking lock ${resource}:`, error);
      return false;
    }
  }

  // ============================================
  // LEADER ELECTION
  // ============================================

  /**
   * Attempt to become the leader for a specific worker type
   *
   * @param workerType - Type of worker (e.g., 'blockchain', 'scheduler')
   * @returns true if this instance is now the leader
   */
  async electLeader(workerType: string): Promise<boolean> {
    const leaderKey = `${LOCK_CONFIG.LEADER_PREFIX}${workerType}`;
    const ttlSeconds = Math.ceil(LOCK_CONFIG.LEADER_TIMEOUT_MS / 1000);

    try {
      // Try to become leader with NX (only if no current leader)
      const result = await redisClient.set(
        leaderKey,
        this.instanceId,
        'EX',
        ttlSeconds,
        'NX'
      );

      if (result === 'OK') {
        logger.info(`[DistributedLock] Elected as leader for: ${workerType}`);
        // Start heartbeat to maintain leadership
        this.startHeartbeat(workerType);
        return true;
      }

      // Check if we're already the leader
      const currentLeader = await redisClient.get(leaderKey);
      if (currentLeader === this.instanceId) {
        // Refresh our leadership
        await redisClient.expire(leaderKey, ttlSeconds);
        return true;
      }

      return false;
    } catch (error) {
      logger.error(`[DistributedLock] Error in leader election for ${workerType}:`, error);
      return false;
    }
  }

  /**
   * Check if this instance is the leader for a worker type
   *
   * @param workerType - Type of worker
   * @returns true if this instance is the leader
   */
  async isLeader(workerType: string): Promise<boolean> {
    const leaderKey = `${LOCK_CONFIG.LEADER_PREFIX}${workerType}`;

    try {
      const currentLeader = await redisClient.get(leaderKey);
      return currentLeader === this.instanceId;
    } catch (error) {
      logger.error(`[DistributedLock] Error checking leadership for ${workerType}:`, error);
      return false;
    }
  }

  /**
   * Get current leader information for a worker type
   *
   * @param workerType - Type of worker
   * @returns Leader information or null if no leader
   */
  async getLeaderInfo(workerType: string): Promise<LeaderInfo | null> {
    const leaderKey = `${LOCK_CONFIG.LEADER_PREFIX}${workerType}`;

    try {
      const [leaderId, ttl] = await Promise.all([
        redisClient.get(leaderKey),
        redisClient.ttl(leaderKey),
      ]);

      if (!leaderId) {
        return null;
      }

      return {
        isLeader: leaderId === this.instanceId,
        leaderId,
        lastHeartbeat: Date.now() - (LOCK_CONFIG.LEADER_TIMEOUT_MS - (ttl * 1000)),
      };
    } catch (error) {
      logger.error(`[DistributedLock] Error getting leader info for ${workerType}:`, error);
      return null;
    }
  }

  /**
   * Send heartbeat to maintain leadership
   *
   * @param workerType - Type of worker
   */
  async heartbeat(workerType: string): Promise<void> {
    const leaderKey = `${LOCK_CONFIG.LEADER_PREFIX}${workerType}`;
    const ttlSeconds = Math.ceil(LOCK_CONFIG.LEADER_TIMEOUT_MS / 1000);

    try {
      // Only extend if we're still the leader
      const luaScript = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("expire", KEYS[1], ARGV[2])
        else
          return 0
        end
      `;

      const result = await redisClient.eval(luaScript, 1, leaderKey, this.instanceId, ttlSeconds);

      if (result !== 1) {
        logger.warn(`[DistributedLock] Lost leadership for: ${workerType}`);
        this.stopHeartbeat(workerType);
      }
    } catch (error) {
      logger.error(`[DistributedLock] Error in heartbeat for ${workerType}:`, error);
    }
  }

  /**
   * Start heartbeat interval for maintaining leadership
   */
  private startHeartbeat(workerType: string): void {
    // Stop existing heartbeat if any
    this.stopHeartbeat(workerType);

    // Start new heartbeat
    const interval = setInterval(
      () => this.heartbeat(workerType),
      LOCK_CONFIG.HEARTBEAT_INTERVAL_MS
    );

    this.heartbeatIntervals.set(workerType, interval);
    logger.debug(`[DistributedLock] Started heartbeat for: ${workerType}`);
  }

  /**
   * Stop heartbeat interval
   */
  private stopHeartbeat(workerType: string): void {
    const interval = this.heartbeatIntervals.get(workerType);
    if (interval) {
      clearInterval(interval);
      this.heartbeatIntervals.delete(workerType);
      logger.debug(`[DistributedLock] Stopped heartbeat for: ${workerType}`);
    }
  }

  /**
   * Resign from leadership
   *
   * @param workerType - Type of worker
   */
  async resignLeadership(workerType: string): Promise<void> {
    const leaderKey = `${LOCK_CONFIG.LEADER_PREFIX}${workerType}`;

    try {
      // Only delete if we're the leader
      const luaScript = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("del", KEYS[1])
        else
          return 0
        end
      `;

      await redisClient.eval(luaScript, 1, leaderKey, this.instanceId);
      this.stopHeartbeat(workerType);
      logger.info(`[DistributedLock] Resigned leadership for: ${workerType}`);
    } catch (error) {
      logger.error(`[DistributedLock] Error resigning leadership for ${workerType}:`, error);
    }
  }

  // ============================================
  // RESOURCE-SPECIFIC LOCKS
  // ============================================

  /**
   * Lock for DID registration
   * Prevents duplicate DID registration across instances
   *
   * @param did - DID string to lock
   * @param ttlMs - Lock TTL (default: 60 seconds for blockchain tx)
   */
  async lockDIDRegistration(did: string, ttlMs: number = 60000): Promise<Lock | null> {
    return this.acquireLockWithRetry(`did:register:${did}`, ttlMs);
  }

  /**
   * Lock for DID key rotation
   * Prevents concurrent key rotation for the same DID
   *
   * @param did - DID string to lock
   * @param ttlMs - Lock TTL
   */
  async lockDIDKeyRotation(did: string, ttlMs: number = 60000): Promise<Lock | null> {
    return this.acquireLockWithRetry(`did:rotate:${did}`, ttlMs);
  }

  /**
   * Lock for VC issuance
   * Prevents duplicate VC issuance with same ID
   *
   * @param vcId - VC ID to lock
   * @param ttlMs - Lock TTL
   */
  async lockVCIssuance(vcId: string, ttlMs: number = 60000): Promise<Lock | null> {
    return this.acquireLockWithRetry(`vc:issue:${vcId}`, ttlMs);
  }

  /**
   * Lock for VC revocation
   * Prevents concurrent revocation attempts
   *
   * @param vcId - VC ID to lock
   * @param ttlMs - Lock TTL
   */
  async lockVCRevocation(vcId: string, ttlMs: number = 60000): Promise<Lock | null> {
    return this.acquireLockWithRetry(`vc:revoke:${vcId}`, ttlMs);
  }

  /**
   * Lock for Schema creation/update
   * Prevents concurrent schema modifications
   *
   * @param schemaId - Schema ID to lock
   * @param ttlMs - Lock TTL
   */
  async lockSchemaModification(schemaId: string, ttlMs: number = 60000): Promise<Lock | null> {
    return this.acquireLockWithRetry(`schema:modify:${schemaId}`, ttlMs);
  }

  /**
   * Lock for blockchain transaction processing
   * Ensures only one instance processes a specific transaction
   *
   * @param transactionId - Transaction ID to lock
   * @param ttlMs - Lock TTL
   */
  async lockBlockchainTransaction(transactionId: string, ttlMs: number = 120000): Promise<Lock | null> {
    return this.acquireLockWithRetry(`tx:process:${transactionId}`, ttlMs);
  }

  /**
   * Lock for payment processing
   * Prevents duplicate payment processing
   *
   * @param paymentId - Payment ID to lock
   * @param ttlMs - Lock TTL
   */
  async lockPaymentProcessing(paymentId: string, ttlMs: number = 60000): Promise<Lock | null> {
    return this.acquireLockWithRetry(`payment:process:${paymentId}`, ttlMs);
  }

  /**
   * Lock for institution registration approval
   * Prevents concurrent approval/rejection
   *
   * @param registrationId - Registration ID to lock
   * @param ttlMs - Lock TTL
   */
  async lockInstitutionApproval(registrationId: string, ttlMs: number = 30000): Promise<Lock | null> {
    return this.acquireLockWithRetry(`institution:approve:${registrationId}`, ttlMs);
  }

  /**
   * Lock for batch operations
   * Prevents concurrent batch processing
   *
   * @param batchId - Batch ID to lock
   * @param ttlMs - Lock TTL (longer for batch operations)
   */
  async lockBatchOperation(batchId: string, ttlMs: number = 300000): Promise<Lock | null> {
    return this.acquireLockWithRetry(`batch:process:${batchId}`, ttlMs);
  }

  // ============================================
  // UTILITY METHODS
  // ============================================

  /**
   * Execute a function with a distributed lock
   * Automatically acquires and releases the lock
   *
   * @param resource - Resource to lock
   * @param fn - Function to execute while holding the lock
   * @param ttlMs - Lock TTL
   * @returns Function result or throws if lock couldn't be acquired
   */
  async withLock<T>(
    resource: string,
    fn: () => Promise<T>,
    ttlMs: number = LOCK_CONFIG.DEFAULT_TTL_MS
  ): Promise<T> {
    const lock = await this.acquireLockWithRetry(resource, ttlMs);

    if (!lock) {
      throw new Error(`Failed to acquire lock for resource: ${resource}`);
    }

    try {
      return await fn();
    } finally {
      await this.releaseLock(lock);
    }
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Cleanup on shutdown
   * Stop all heartbeats and resign all leaderships
   */
  async cleanup(): Promise<void> {
    logger.info('[DistributedLock] Cleaning up...');

    // Stop all heartbeats
    for (const workerType of this.heartbeatIntervals.keys()) {
      await this.resignLeadership(workerType);
    }

    logger.info('[DistributedLock] Cleanup complete');
  }
}

// Export singleton instance
const distributedLockService = new DistributedLockService();
export default distributedLockService;

// Export class for testing
export { DistributedLockService };
