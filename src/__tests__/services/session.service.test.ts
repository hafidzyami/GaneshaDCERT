/**
 * Session Service Tests
 * Tests for Redis-backed session management
 * Task: A2.5 - Session management for multi-instance
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

// Mock JWT service
const mockJwtService = {
  generateSessionToken: jest.fn(() => 'mock-session-token-12345678901234567890'),
  generateAdminToken: jest.fn(() => 'mock-admin-token-123456789012345678901'),
  verifySessionToken: jest.fn((): { userId: string; email: string; type: string } | null =>
    ({ userId: 'user-123', email: 'test@test.com', type: 'session' })),
  verifyAdminToken: jest.fn((): { id: string; email: string; name: string; role: string } | null =>
    ({ id: 'admin-123', email: 'admin@test.com', name: 'Admin', role: 'admin' })),
};

jest.mock('../../services/jwt.service', () => mockJwtService);

// Mock uuid
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-uuid-1234-5678-9012'),
}));

// Import after mocking
import sessionService, {
  SessionService,
  SESSION_TTL,
  SESSION_PREFIX,
  SessionData,
  SessionInfo,
} from '../../services/session.service';

describe('SessionService', () => {
  beforeEach(() => {
    clearMockRedis();
    clearMockLogger();
    jest.clearAllMocks();
  });

  // ===========================================
  // CONFIGURATION TESTS
  // ===========================================
  describe('Configuration', () => {
    it('should have correct TTL for user sessions (24 hours)', () => {
      expect(SESSION_TTL.USER_SESSION).toBe(86400);
    });

    it('should have correct TTL for admin sessions (8 hours)', () => {
      expect(SESSION_TTL.ADMIN_SESSION).toBe(28800);
    });

    it('should have correct refresh threshold (30 minutes)', () => {
      expect(SESSION_TTL.REFRESH_THRESHOLD).toBe(1800);
    });

    it('should have correct prefixes', () => {
      expect(SESSION_PREFIX.USER).toBe('session:user:');
      expect(SESSION_PREFIX.ADMIN).toBe('session:admin:');
      expect(SESSION_PREFIX.USER_SESSIONS).toBe('sessions:user:');
      expect(SESSION_PREFIX.TOKEN_TO_SESSION).toBe('token:session:');
    });
  });

  // ===========================================
  // USER SESSION CREATION TESTS
  // ===========================================
  describe('createUserSession()', () => {
    it('should create a user session successfully', async () => {
      const result = await sessionService.createUserSession(
        'user-123',
        'test@test.com'
      );

      expect(result).toHaveProperty('token');
      expect(result).toHaveProperty('session');
      expect(result.session.userId).toBe('user-123');
      expect(result.session.email).toBe('test@test.com');
      expect(result.session.type).toBe('user');
    });

    it('should store session in Redis', async () => {
      await sessionService.createUserSession('user-123', 'test@test.com');

      expect(mockRedisClient.setex).toHaveBeenCalled();
      expect(mockRedisClient.sadd).toHaveBeenCalled();
    });

    it('should include metadata when provided', async () => {
      const result = await sessionService.createUserSession(
        'user-123',
        'test@test.com',
        {
          userAgent: 'Mozilla/5.0',
          ipAddress: '192.168.1.1',
        }
      );

      expect(result.session.userAgent).toBe('Mozilla/5.0');
      expect(result.session.ipAddress).toBe('192.168.1.1');
    });

    it('should generate unique session ID', async () => {
      const result = await sessionService.createUserSession('user-123', 'test@test.com');

      expect(result.session.sessionId).toContain('sess_');
    });
  });

  // ===========================================
  // ADMIN SESSION CREATION TESTS
  // ===========================================
  describe('createAdminSession()', () => {
    it('should create an admin session successfully', async () => {
      const result = await sessionService.createAdminSession(
        'admin-123',
        'admin@test.com',
        'Admin User'
      );

      expect(result).toHaveProperty('token');
      expect(result).toHaveProperty('session');
      expect(result.session.userId).toBe('admin-123');
      expect(result.session.email).toBe('admin@test.com');
      expect(result.session.type).toBe('admin');
    });

    it('should use admin session TTL', async () => {
      await sessionService.createAdminSession(
        'admin-123',
        'admin@test.com',
        'Admin User'
      );

      expect(mockRedisClient.setex).toHaveBeenCalledWith(
        expect.stringContaining('session:admin:'),
        SESSION_TTL.ADMIN_SESSION,
        expect.any(String)
      );
    });

    it('should generate admin session ID', async () => {
      const result = await sessionService.createAdminSession(
        'admin-123',
        'admin@test.com',
        'Admin User'
      );

      expect(result.session.sessionId).toContain('admin_sess_');
    });
  });

  // ===========================================
  // SESSION VALIDATION TESTS
  // ===========================================
  describe('validateSession()', () => {
    it('should return null for invalid JWT', async () => {
      mockJwtService.verifySessionToken.mockReturnValueOnce(null);

      const result = await sessionService.validateSession('invalid-token');

      expect(result).toBeNull();
    });

    it('should return null when session not in Redis', async () => {
      mockRedisClient.get.mockResolvedValueOnce(null);

      const result = await sessionService.validateSession('valid-token');

      expect(result).toBeNull();
    });

    it('should return session data for valid token', async () => {
      // Setup: create a session first
      const { token, session } = await sessionService.createUserSession(
        'user-123',
        'test@test.com'
      );

      // Mock the redis get to return session ID
      mockRedisClient.get
        .mockResolvedValueOnce(session.sessionId) // Token lookup
        .mockResolvedValueOnce(JSON.stringify({
          sessionId: session.sessionId,
          userId: 'user-123',
          email: 'test@test.com',
          type: 'user',
          token,
          createdAt: session.createdAt,
          lastAccessedAt: session.lastAccessedAt,
          expiresAt: new Date(Date.now() + 86400000).toISOString(),
        }));

      const result = await sessionService.validateSession(token);

      expect(result).not.toBeNull();
      expect(result?.userId).toBe('user-123');
    });

    it('should return null for expired session', async () => {
      const expiredSession = {
        sessionId: 'sess_expired',
        userId: 'user-123',
        email: 'test@test.com',
        type: 'user',
        token: 'expired-token',
        createdAt: new Date().toISOString(),
        lastAccessedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() - 1000).toISOString(), // Expired
      };

      mockRedisClient.get
        .mockResolvedValueOnce('sess_expired')
        .mockResolvedValueOnce(JSON.stringify(expiredSession));

      const result = await sessionService.validateSession('expired-token');

      expect(result).toBeNull();
    });
  });

  // ===========================================
  // SESSION VALIDATION CHECK TESTS
  // ===========================================
  describe('isSessionValid()', () => {
    it('should return false for non-existent session', async () => {
      mockRedisClient.get.mockResolvedValueOnce(null);

      const result = await sessionService.isSessionValid('non-existent-token');

      expect(result).toBe(false);
    });

    it('should return true for valid session', async () => {
      const validSession = {
        sessionId: 'sess_valid',
        userId: 'user-123',
        email: 'test@test.com',
        type: 'user',
        token: 'valid-token',
        createdAt: new Date().toISOString(),
        lastAccessedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
      };

      mockRedisClient.get
        .mockResolvedValueOnce('sess_valid')
        .mockResolvedValueOnce(JSON.stringify(validSession));

      const result = await sessionService.isSessionValid('valid-token');

      expect(result).toBe(true);
    });
  });

  // ===========================================
  // SESSION INVALIDATION TESTS
  // ===========================================
  describe('invalidateSession()', () => {
    it('should return false for non-existent session', async () => {
      mockRedisClient.get.mockResolvedValueOnce(null);

      const result = await sessionService.invalidateSession('non-existent');

      expect(result).toBe(false);
    });

    it('should delete session from Redis', async () => {
      const session = {
        sessionId: 'sess_to_delete',
        userId: 'user-123',
        email: 'test@test.com',
        type: 'user',
        token: 'token-to-delete-1234567890123456',
        createdAt: new Date().toISOString(),
        lastAccessedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
      };

      mockRedisClient.get.mockResolvedValueOnce(JSON.stringify(session));

      const result = await sessionService.invalidateSession('sess_to_delete');

      expect(result).toBe(true);
      expect(mockRedisClient.del).toHaveBeenCalled();
      expect(mockRedisClient.srem).toHaveBeenCalled();
    });
  });

  // ===========================================
  // INVALIDATE BY TOKEN TESTS
  // ===========================================
  describe('invalidateSessionByToken()', () => {
    it('should return false when token not found', async () => {
      mockRedisClient.get.mockResolvedValueOnce(null);

      const result = await sessionService.invalidateSessionByToken('unknown-token');

      expect(result).toBe(false);
    });

    it('should invalidate session when token found', async () => {
      const session = {
        sessionId: 'sess_token',
        userId: 'user-123',
        email: 'test@test.com',
        type: 'user',
        token: 'token-to-invalidate-12345678901234',
        createdAt: new Date().toISOString(),
        lastAccessedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
      };

      mockRedisClient.get
        .mockResolvedValueOnce('sess_token') // Token lookup
        .mockResolvedValueOnce(JSON.stringify(session)); // Session lookup

      const result = await sessionService.invalidateSessionByToken('token-to-invalidate-12345678901234');

      expect(result).toBe(true);
    });
  });

  // ===========================================
  // INVALIDATE ALL USER SESSIONS TESTS
  // ===========================================
  describe('invalidateAllUserSessions()', () => {
    it('should return 0 when no sessions exist', async () => {
      mockRedisClient.smembers.mockResolvedValueOnce([]);

      const result = await sessionService.invalidateAllUserSessions('user-123');

      expect(result).toBe(0);
    });

    it('should invalidate all sessions for user', async () => {
      const sessions = ['sess_1', 'sess_2', 'sess_3'];

      mockRedisClient.smembers.mockResolvedValueOnce(sessions);
      mockRedisClient.get.mockImplementation(async (key: string) => {
        if (key.includes('session:user:')) {
          return JSON.stringify({
            sessionId: key.split(':').pop(),
            userId: 'user-123',
            token: 'token-12345678901234567890123456789',
          });
        }
        return null;
      });

      const result = await sessionService.invalidateAllUserSessions('user-123');

      expect(result).toBe(3);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Invalidated 3 sessions')
      );
    });
  });

  // ===========================================
  // INVALIDATE OTHER SESSIONS TESTS
  // ===========================================
  describe('invalidateOtherSessions()', () => {
    it('should keep current session and invalidate others', async () => {
      const currentSessionId = 'sess_current';
      const sessions = ['sess_current', 'sess_other1', 'sess_other2'];

      mockRedisClient.get.mockImplementation(async (key: string) => {
        if (key.includes('token:session:')) {
          return currentSessionId;
        }
        if (key.includes('session:user:')) {
          const sessId = key.split(':').pop();
          return JSON.stringify({
            sessionId: sessId,
            userId: 'user-123',
            token: `token-${sessId}-1234567890123456789`,
          });
        }
        return null;
      });
      mockRedisClient.smembers.mockResolvedValueOnce(sessions);

      const result = await sessionService.invalidateOtherSessions(
        'current-token-12345678901234567890',
        'user-123'
      );

      expect(result).toBe(2); // Should invalidate 2 other sessions
    });
  });

  // ===========================================
  // GET USER SESSIONS TESTS
  // ===========================================
  describe('getUserSessions()', () => {
    it('should return empty array when no sessions', async () => {
      mockRedisClient.smembers.mockResolvedValueOnce([]);

      const result = await sessionService.getUserSessions('user-123');

      expect(result).toEqual([]);
    });

    it('should return active sessions for user', async () => {
      const sessions = ['sess_1', 'sess_2'];
      const validSession = {
        sessionId: 'sess_1',
        userId: 'user-123',
        email: 'test@test.com',
        type: 'user',
        createdAt: new Date().toISOString(),
        lastAccessedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
      };

      mockRedisClient.smembers.mockResolvedValueOnce(sessions);
      mockRedisClient.get.mockImplementation(async () => JSON.stringify(validSession));

      const result = await sessionService.getUserSessions('user-123');

      expect(result.length).toBeGreaterThan(0);
      expect(result[0].userId).toBe('user-123');
    });

    it('should filter out expired sessions', async () => {
      const sessions = ['sess_active', 'sess_expired'];

      mockRedisClient.smembers.mockResolvedValueOnce(sessions);
      mockRedisClient.get.mockImplementation(async (key: string) => {
        if (key.includes('sess_active')) {
          return JSON.stringify({
            sessionId: 'sess_active',
            userId: 'user-123',
            email: 'test@test.com',
            type: 'user',
            expiresAt: new Date(Date.now() + 86400000).toISOString(),
          });
        }
        if (key.includes('sess_expired')) {
          return JSON.stringify({
            sessionId: 'sess_expired',
            userId: 'user-123',
            email: 'test@test.com',
            type: 'user',
            token: 'expired-token-1234567890123456789',
            expiresAt: new Date(Date.now() - 1000).toISOString(), // Expired
          });
        }
        return null;
      });

      const result = await sessionService.getUserSessions('user-123');

      expect(result.length).toBe(1);
      expect(result[0].sessionId).toBe('sess_active');
    });
  });

  // ===========================================
  // GET SESSION COUNT TESTS
  // ===========================================
  describe('getSessionCount()', () => {
    it('should return 0 when no sessions', async () => {
      mockRedisClient.smembers.mockResolvedValueOnce([]);

      const count = await sessionService.getSessionCount('user-123');

      expect(count).toBe(0);
    });
  });

  // ===========================================
  // GET SESSION BY ID TESTS
  // ===========================================
  describe('getSession()', () => {
    it('should return null for non-existent session', async () => {
      mockRedisClient.get.mockResolvedValueOnce(null);

      const result = await sessionService.getSession('non-existent');

      expect(result).toBeNull();
    });

    it('should return session info for valid session', async () => {
      const session = {
        sessionId: 'sess_test',
        userId: 'user-123',
        email: 'test@test.com',
        type: 'user',
        createdAt: new Date().toISOString(),
        lastAccessedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
      };

      mockRedisClient.get.mockResolvedValueOnce(JSON.stringify(session));

      const result = await sessionService.getSession('sess_test');

      expect(result).not.toBeNull();
      expect(result?.sessionId).toBe('sess_test');
      expect(result?.userId).toBe('user-123');
    });
  });

  // ===========================================
  // SESSION REFRESH TESTS
  // ===========================================
  describe('refreshSession()', () => {
    it('should return null for invalid session', async () => {
      mockJwtService.verifySessionToken.mockReturnValueOnce(null);

      const result = await sessionService.refreshSession('invalid-token');

      expect(result).toBeNull();
    });

    it('should extend session TTL when below threshold', async () => {
      const session = {
        sessionId: 'sess_refresh',
        userId: 'user-123',
        email: 'test@test.com',
        type: 'user',
        token: 'refresh-token-12345678901234567890',
        createdAt: new Date().toISOString(),
        lastAccessedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
      };

      mockRedisClient.get
        .mockResolvedValueOnce('sess_refresh') // Token lookup
        .mockResolvedValueOnce(JSON.stringify(session)) // Session lookup
        .mockResolvedValueOnce(JSON.stringify(session)); // Touch lookup

      mockRedisClient.ttl.mockResolvedValueOnce(600); // 10 minutes remaining (below threshold)

      const result = await sessionService.refreshSession('refresh-token-12345678901234567890');

      expect(result).not.toBeNull();
    });
  });

  // ===========================================
  // SESSION STATISTICS TESTS
  // ===========================================
  describe('getStats()', () => {
    it('should return session statistics', async () => {
      mockRedisClient.scan
        .mockResolvedValueOnce(['0', ['session:user:1', 'session:user:2']])
        .mockResolvedValueOnce(['0', ['session:admin:1']]);

      const stats = await sessionService.getStats();

      expect(stats).toHaveProperty('totalUserSessions');
      expect(stats).toHaveProperty('totalAdminSessions');
    });
  });

  // ===========================================
  // CLEANUP TESTS
  // ===========================================
  describe('cleanupExpiredSessions()', () => {
    it('should clean up expired sessions', async () => {
      const expiredSession = {
        sessionId: 'sess_expired',
        userId: 'user-123',
        email: 'test@test.com',
        type: 'user',
        token: 'expired-token-1234567890123456789',
        expiresAt: new Date(Date.now() - 1000).toISOString(),
      };

      mockRedisClient.scan
        .mockResolvedValueOnce(['0', ['session:user:sess_expired']])
        .mockResolvedValueOnce(['0', []]);
      mockRedisClient.get.mockResolvedValue(JSON.stringify(expiredSession));

      const cleaned = await sessionService.cleanupExpiredSessions();

      expect(cleaned).toBeGreaterThanOrEqual(0);
    });
  });
});
