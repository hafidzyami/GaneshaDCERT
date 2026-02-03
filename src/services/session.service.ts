/**
 * Session Service
 * Redis-backed session management for multi-instance deployment
 * Task: A2.5 - Session management for multi-instance
 */

import redisClient from '../config/redis';
import logger from '../config/logger';
import { v4 as uuidv4 } from 'uuid';
import {
  generateSessionToken,
  generateAdminToken,
  verifySessionToken,
  verifyAdminToken,
} from './jwt.service';

/**
 * Session TTL Configuration (in seconds)
 */
export const SESSION_TTL = {
  USER_SESSION: 24 * 60 * 60,      // 24 hours for user sessions
  ADMIN_SESSION: 8 * 60 * 60,      // 8 hours for admin sessions
  REFRESH_THRESHOLD: 30 * 60,      // Refresh if less than 30 minutes remaining
} as const;

/**
 * Session key prefixes
 */
export const SESSION_PREFIX = {
  USER: 'session:user:',
  ADMIN: 'session:admin:',
  USER_SESSIONS: 'sessions:user:',    // Set of all session IDs for a user
  ADMIN_SESSIONS: 'sessions:admin:',  // Set of all session IDs for an admin
  TOKEN_TO_SESSION: 'token:session:', // Map token hash to session ID
} as const;

/**
 * Session types
 */
export type SessionType = 'user' | 'admin';

/**
 * Session data interface
 */
export interface SessionData {
  sessionId: string;
  userId: string;
  email: string;
  name?: string;
  type: SessionType;
  token: string;
  createdAt: string;
  lastAccessedAt: string;
  expiresAt: string;
  userAgent?: string;
  ipAddress?: string;
  instanceId?: string;  // Which instance created this session
}

/**
 * Session info (without sensitive data)
 */
export interface SessionInfo {
  sessionId: string;
  userId: string;
  email: string;
  type: SessionType;
  createdAt: string;
  lastAccessedAt: string;
  expiresAt: string;
  userAgent?: string;
  ipAddress?: string;
  isCurrent?: boolean;
}

/**
 * Session Service Class
 * Manages sessions in Redis for multi-instance support
 */
class SessionService {
  private instanceId: string;

  constructor() {
    this.instanceId = `session-svc:${uuidv4().slice(0, 8)}`;
    logger.info(`[SessionService] Initialized with instance ID: ${this.instanceId}`);
  }

  // ============================================
  // SESSION CREATION
  // ============================================

  /**
   * Create a new user session
   * Called after magic link verification
   *
   * @param userId - Institution ID
   * @param email - User email
   * @param metadata - Optional session metadata
   * @returns Session data with JWT token
   */
  async createUserSession(
    userId: string,
    email: string,
    metadata?: {
      userAgent?: string;
      ipAddress?: string;
    }
  ): Promise<{ token: string; session: SessionInfo }> {
    const sessionId = `sess_${uuidv4()}`;
    const token = generateSessionToken(userId, email);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + SESSION_TTL.USER_SESSION * 1000);

    const sessionData: SessionData = {
      sessionId,
      userId,
      email,
      type: 'user',
      token,
      createdAt: now.toISOString(),
      lastAccessedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      userAgent: metadata?.userAgent,
      ipAddress: metadata?.ipAddress,
      instanceId: this.instanceId,
    };

    // Store session in Redis
    await this.storeSession(sessionData);

    logger.info(`[SessionService] Created user session: ${sessionId} for ${email}`);

    return {
      token,
      session: this.toSessionInfo(sessionData),
    };
  }

  /**
   * Create a new admin session
   *
   * @param adminId - Admin ID
   * @param email - Admin email
   * @param name - Admin name
   * @param metadata - Optional session metadata
   * @returns Session data with JWT token
   */
  async createAdminSession(
    adminId: string,
    email: string,
    name: string,
    metadata?: {
      userAgent?: string;
      ipAddress?: string;
    }
  ): Promise<{ token: string; session: SessionInfo }> {
    const sessionId = `admin_sess_${uuidv4()}`;
    const token = generateAdminToken(adminId, email, name);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + SESSION_TTL.ADMIN_SESSION * 1000);

    const sessionData: SessionData = {
      sessionId,
      userId: adminId,
      email,
      name,
      type: 'admin',
      token,
      createdAt: now.toISOString(),
      lastAccessedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      userAgent: metadata?.userAgent,
      ipAddress: metadata?.ipAddress,
      instanceId: this.instanceId,
    };

    // Store session in Redis
    await this.storeSession(sessionData);

    logger.info(`[SessionService] Created admin session: ${sessionId} for ${email}`);

    return {
      token,
      session: this.toSessionInfo(sessionData),
    };
  }

  /**
   * Store session in Redis
   */
  private async storeSession(session: SessionData): Promise<void> {
    const prefix = session.type === 'admin' ? SESSION_PREFIX.ADMIN : SESSION_PREFIX.USER;
    const sessionsPrefix = session.type === 'admin' ? SESSION_PREFIX.ADMIN_SESSIONS : SESSION_PREFIX.USER_SESSIONS;
    const ttl = session.type === 'admin' ? SESSION_TTL.ADMIN_SESSION : SESSION_TTL.USER_SESSION;

    const sessionKey = `${prefix}${session.sessionId}`;
    const userSessionsKey = `${sessionsPrefix}${session.userId}`;
    const tokenKey = `${SESSION_PREFIX.TOKEN_TO_SESSION}${this.hashToken(session.token)}`;

    try {
      // Store session data
      await redisClient.setex(sessionKey, ttl, JSON.stringify(session));

      // Add session ID to user's session set
      await redisClient.sadd(userSessionsKey, session.sessionId);
      await redisClient.expire(userSessionsKey, ttl);

      // Map token to session ID (for quick lookup)
      await redisClient.setex(tokenKey, ttl, session.sessionId);
    } catch (error) {
      logger.error(`[SessionService] Error storing session:`, error);
      throw error;
    }
  }

  // ============================================
  // SESSION VALIDATION
  // ============================================

  /**
   * Validate and get session by token
   *
   * @param token - JWT token
   * @param type - Session type (user or admin)
   * @returns Session data if valid, null otherwise
   */
  async validateSession(token: string, type: SessionType = 'user'): Promise<SessionData | null> {
    try {
      // First verify JWT signature
      const decoded = type === 'admin' ? verifyAdminToken(token) : verifySessionToken(token);
      if (!decoded) {
        logger.debug(`[SessionService] JWT verification failed`);
        return null;
      }

      // Look up session by token hash
      const tokenKey = `${SESSION_PREFIX.TOKEN_TO_SESSION}${this.hashToken(token)}`;
      const sessionId = await redisClient.get(tokenKey);

      if (!sessionId) {
        logger.debug(`[SessionService] Session not found for token`);
        return null;
      }

      // Get session data
      const prefix = type === 'admin' ? SESSION_PREFIX.ADMIN : SESSION_PREFIX.USER;
      const sessionKey = `${prefix}${sessionId}`;
      const sessionJson = await redisClient.get(sessionKey);

      if (!sessionJson) {
        logger.debug(`[SessionService] Session data not found: ${sessionId}`);
        return null;
      }

      const session = JSON.parse(sessionJson) as SessionData;

      // Check if session is expired
      if (new Date(session.expiresAt) < new Date()) {
        logger.debug(`[SessionService] Session expired: ${sessionId}`);
        await this.invalidateSession(sessionId, type);
        return null;
      }

      // Update last accessed time
      await this.touchSession(sessionId, type);

      return session;
    } catch (error) {
      logger.error(`[SessionService] Error validating session:`, error);
      return null;
    }
  }

  /**
   * Check if a session is valid without updating last accessed
   */
  async isSessionValid(token: string, type: SessionType = 'user'): Promise<boolean> {
    const session = await this.getSessionByToken(token, type);
    if (!session) return false;

    return new Date(session.expiresAt) > new Date();
  }

  /**
   * Get session by token without updating last accessed
   */
  private async getSessionByToken(token: string, type: SessionType): Promise<SessionData | null> {
    try {
      const tokenKey = `${SESSION_PREFIX.TOKEN_TO_SESSION}${this.hashToken(token)}`;
      const sessionId = await redisClient.get(tokenKey);

      if (!sessionId) return null;

      const prefix = type === 'admin' ? SESSION_PREFIX.ADMIN : SESSION_PREFIX.USER;
      const sessionKey = `${prefix}${sessionId}`;
      const sessionJson = await redisClient.get(sessionKey);

      if (!sessionJson) return null;

      return JSON.parse(sessionJson) as SessionData;
    } catch (error) {
      logger.error(`[SessionService] Error getting session by token:`, error);
      return null;
    }
  }

  // ============================================
  // SESSION UPDATE
  // ============================================

  /**
   * Update session last accessed time
   */
  private async touchSession(sessionId: string, type: SessionType): Promise<void> {
    const prefix = type === 'admin' ? SESSION_PREFIX.ADMIN : SESSION_PREFIX.USER;
    const sessionKey = `${prefix}${sessionId}`;

    try {
      const sessionJson = await redisClient.get(sessionKey);
      if (!sessionJson) return;

      const session = JSON.parse(sessionJson) as SessionData;
      session.lastAccessedAt = new Date().toISOString();

      const ttl = await redisClient.ttl(sessionKey);
      if (ttl > 0) {
        await redisClient.setex(sessionKey, ttl, JSON.stringify(session));
      }
    } catch (error) {
      logger.error(`[SessionService] Error touching session:`, error);
    }
  }

  /**
   * Refresh session - extend TTL if close to expiry
   */
  async refreshSession(token: string, type: SessionType = 'user'): Promise<SessionData | null> {
    try {
      const session = await this.validateSession(token, type);
      if (!session) return null;

      const prefix = type === 'admin' ? SESSION_PREFIX.ADMIN : SESSION_PREFIX.USER;
      const sessionsPrefix = type === 'admin' ? SESSION_PREFIX.ADMIN_SESSIONS : SESSION_PREFIX.USER_SESSIONS;
      const fullTtl = type === 'admin' ? SESSION_TTL.ADMIN_SESSION : SESSION_TTL.USER_SESSION;

      const sessionKey = `${prefix}${session.sessionId}`;
      const currentTtl = await redisClient.ttl(sessionKey);

      // Only refresh if TTL is below threshold
      if (currentTtl > 0 && currentTtl < SESSION_TTL.REFRESH_THRESHOLD) {
        const now = new Date();
        const newExpiresAt = new Date(now.getTime() + fullTtl * 1000);

        session.lastAccessedAt = now.toISOString();
        session.expiresAt = newExpiresAt.toISOString();

        // Update all related keys
        const tokenKey = `${SESSION_PREFIX.TOKEN_TO_SESSION}${this.hashToken(session.token)}`;
        const userSessionsKey = `${sessionsPrefix}${session.userId}`;

        await Promise.all([
          redisClient.setex(sessionKey, fullTtl, JSON.stringify(session)),
          redisClient.expire(tokenKey, fullTtl),
          redisClient.expire(userSessionsKey, fullTtl),
        ]);

        logger.info(`[SessionService] Refreshed session: ${session.sessionId}`);
      }

      return session;
    } catch (error) {
      logger.error(`[SessionService] Error refreshing session:`, error);
      return null;
    }
  }

  // ============================================
  // SESSION INVALIDATION
  // ============================================

  /**
   * Invalidate a specific session (logout)
   */
  async invalidateSession(sessionId: string, type: SessionType = 'user'): Promise<boolean> {
    const prefix = type === 'admin' ? SESSION_PREFIX.ADMIN : SESSION_PREFIX.USER;
    const sessionsPrefix = type === 'admin' ? SESSION_PREFIX.ADMIN_SESSIONS : SESSION_PREFIX.USER_SESSIONS;

    try {
      const sessionKey = `${prefix}${sessionId}`;
      const sessionJson = await redisClient.get(sessionKey);

      if (!sessionJson) {
        return false;
      }

      const session = JSON.parse(sessionJson) as SessionData;

      // Remove token mapping
      const tokenKey = `${SESSION_PREFIX.TOKEN_TO_SESSION}${this.hashToken(session.token)}`;
      await redisClient.del(tokenKey);

      // Remove from user's session set
      const userSessionsKey = `${sessionsPrefix}${session.userId}`;
      await redisClient.srem(userSessionsKey, sessionId);

      // Remove session data
      await redisClient.del(sessionKey);

      logger.info(`[SessionService] Invalidated session: ${sessionId}`);
      return true;
    } catch (error) {
      logger.error(`[SessionService] Error invalidating session:`, error);
      return false;
    }
  }

  /**
   * Invalidate session by token (logout with token)
   */
  async invalidateSessionByToken(token: string, type: SessionType = 'user'): Promise<boolean> {
    try {
      const tokenKey = `${SESSION_PREFIX.TOKEN_TO_SESSION}${this.hashToken(token)}`;
      const sessionId = await redisClient.get(tokenKey);

      if (!sessionId) {
        return false;
      }

      return await this.invalidateSession(sessionId, type);
    } catch (error) {
      logger.error(`[SessionService] Error invalidating session by token:`, error);
      return false;
    }
  }

  /**
   * Invalidate all sessions for a user (force logout from all devices)
   */
  async invalidateAllUserSessions(userId: string, type: SessionType = 'user'): Promise<number> {
    const prefix = type === 'admin' ? SESSION_PREFIX.ADMIN : SESSION_PREFIX.USER;
    const sessionsPrefix = type === 'admin' ? SESSION_PREFIX.ADMIN_SESSIONS : SESSION_PREFIX.USER_SESSIONS;

    try {
      const userSessionsKey = `${sessionsPrefix}${userId}`;
      const sessionIds = await redisClient.smembers(userSessionsKey);

      if (sessionIds.length === 0) {
        return 0;
      }

      let invalidated = 0;

      for (const sessionId of sessionIds) {
        const sessionKey = `${prefix}${sessionId}`;
        const sessionJson = await redisClient.get(sessionKey);

        if (sessionJson) {
          const session = JSON.parse(sessionJson) as SessionData;

          // Remove token mapping
          const tokenKey = `${SESSION_PREFIX.TOKEN_TO_SESSION}${this.hashToken(session.token)}`;
          await redisClient.del(tokenKey);

          // Remove session
          await redisClient.del(sessionKey);
          invalidated++;
        }
      }

      // Remove the sessions set
      await redisClient.del(userSessionsKey);

      logger.info(`[SessionService] Invalidated ${invalidated} sessions for user: ${userId}`);
      return invalidated;
    } catch (error) {
      logger.error(`[SessionService] Error invalidating all sessions:`, error);
      return 0;
    }
  }

  /**
   * Invalidate all sessions except current (logout other devices)
   */
  async invalidateOtherSessions(
    currentToken: string,
    userId: string,
    type: SessionType = 'user'
  ): Promise<number> {
    const prefix = type === 'admin' ? SESSION_PREFIX.ADMIN : SESSION_PREFIX.USER;
    const sessionsPrefix = type === 'admin' ? SESSION_PREFIX.ADMIN_SESSIONS : SESSION_PREFIX.USER_SESSIONS;

    try {
      // Get current session ID
      const tokenKey = `${SESSION_PREFIX.TOKEN_TO_SESSION}${this.hashToken(currentToken)}`;
      const currentSessionId = await redisClient.get(tokenKey);

      const userSessionsKey = `${sessionsPrefix}${userId}`;
      const sessionIds = await redisClient.smembers(userSessionsKey);

      let invalidated = 0;

      for (const sessionId of sessionIds) {
        // Skip current session
        if (sessionId === currentSessionId) continue;

        const sessionKey = `${prefix}${sessionId}`;
        const sessionJson = await redisClient.get(sessionKey);

        if (sessionJson) {
          const session = JSON.parse(sessionJson) as SessionData;

          // Remove token mapping
          const otherTokenKey = `${SESSION_PREFIX.TOKEN_TO_SESSION}${this.hashToken(session.token)}`;
          await redisClient.del(otherTokenKey);

          // Remove session
          await redisClient.del(sessionKey);

          // Remove from set
          await redisClient.srem(userSessionsKey, sessionId);
          invalidated++;
        }
      }

      logger.info(`[SessionService] Invalidated ${invalidated} other sessions for user: ${userId}`);
      return invalidated;
    } catch (error) {
      logger.error(`[SessionService] Error invalidating other sessions:`, error);
      return 0;
    }
  }

  // ============================================
  // SESSION QUERIES
  // ============================================

  /**
   * Get all active sessions for a user
   */
  async getUserSessions(userId: string, type: SessionType = 'user'): Promise<SessionInfo[]> {
    const prefix = type === 'admin' ? SESSION_PREFIX.ADMIN : SESSION_PREFIX.USER;
    const sessionsPrefix = type === 'admin' ? SESSION_PREFIX.ADMIN_SESSIONS : SESSION_PREFIX.USER_SESSIONS;

    try {
      const userSessionsKey = `${sessionsPrefix}${userId}`;
      const sessionIds = await redisClient.smembers(userSessionsKey);

      const sessions: SessionInfo[] = [];

      for (const sessionId of sessionIds) {
        const sessionKey = `${prefix}${sessionId}`;
        const sessionJson = await redisClient.get(sessionKey);

        if (sessionJson) {
          const session = JSON.parse(sessionJson) as SessionData;

          // Skip expired sessions
          if (new Date(session.expiresAt) > new Date()) {
            sessions.push(this.toSessionInfo(session));
          } else {
            // Clean up expired session
            await this.invalidateSession(sessionId, type);
          }
        }
      }

      return sessions;
    } catch (error) {
      logger.error(`[SessionService] Error getting user sessions:`, error);
      return [];
    }
  }

  /**
   * Get session count for a user
   */
  async getSessionCount(userId: string, type: SessionType = 'user'): Promise<number> {
    const sessions = await this.getUserSessions(userId, type);
    return sessions.length;
  }

  /**
   * Get session by ID
   */
  async getSession(sessionId: string, type: SessionType = 'user'): Promise<SessionInfo | null> {
    const prefix = type === 'admin' ? SESSION_PREFIX.ADMIN : SESSION_PREFIX.USER;

    try {
      const sessionKey = `${prefix}${sessionId}`;
      const sessionJson = await redisClient.get(sessionKey);

      if (!sessionJson) return null;

      const session = JSON.parse(sessionJson) as SessionData;
      return this.toSessionInfo(session);
    } catch (error) {
      logger.error(`[SessionService] Error getting session:`, error);
      return null;
    }
  }

  // ============================================
  // SESSION STATISTICS
  // ============================================

  /**
   * Get session statistics
   */
  async getStats(): Promise<{
    totalUserSessions: number;
    totalAdminSessions: number;
  }> {
    try {
      // Count user sessions
      let userCursor = '0';
      let userCount = 0;
      do {
        const result = await redisClient.scan(
          userCursor,
          'MATCH',
          `${SESSION_PREFIX.USER}*`,
          'COUNT',
          100
        );
        userCursor = result[0];
        userCount += result[1].length;
      } while (userCursor !== '0');

      // Count admin sessions
      let adminCursor = '0';
      let adminCount = 0;
      do {
        const result = await redisClient.scan(
          adminCursor,
          'MATCH',
          `${SESSION_PREFIX.ADMIN}*`,
          'COUNT',
          100
        );
        adminCursor = result[0];
        adminCount += result[1].length;
      } while (adminCursor !== '0');

      return {
        totalUserSessions: userCount,
        totalAdminSessions: adminCount,
      };
    } catch (error) {
      logger.error(`[SessionService] Error getting stats:`, error);
      return {
        totalUserSessions: 0,
        totalAdminSessions: 0,
      };
    }
  }

  // ============================================
  // UTILITY METHODS
  // ============================================

  /**
   * Hash token for storage (to avoid storing full token as key)
   */
  private hashToken(token: string): string {
    // Use last 32 chars of token as hash (unique enough and shorter)
    return token.slice(-32);
  }

  /**
   * Convert SessionData to SessionInfo (remove sensitive data)
   */
  private toSessionInfo(session: SessionData): SessionInfo {
    return {
      sessionId: session.sessionId,
      userId: session.userId,
      email: session.email,
      type: session.type,
      createdAt: session.createdAt,
      lastAccessedAt: session.lastAccessedAt,
      expiresAt: session.expiresAt,
      userAgent: session.userAgent,
      ipAddress: session.ipAddress,
    };
  }

  /**
   * Cleanup expired sessions (maintenance task)
   */
  async cleanupExpiredSessions(): Promise<number> {
    let cleaned = 0;

    try {
      // Scan and clean user sessions
      let cursor = '0';
      do {
        const result = await redisClient.scan(
          cursor,
          'MATCH',
          `${SESSION_PREFIX.USER}*`,
          'COUNT',
          100
        );
        cursor = result[0];

        for (const key of result[1]) {
          const sessionJson = await redisClient.get(key);
          if (sessionJson) {
            const session = JSON.parse(sessionJson) as SessionData;
            if (new Date(session.expiresAt) < new Date()) {
              await this.invalidateSession(session.sessionId, 'user');
              cleaned++;
            }
          }
        }
      } while (cursor !== '0');

      // Scan and clean admin sessions
      cursor = '0';
      do {
        const result = await redisClient.scan(
          cursor,
          'MATCH',
          `${SESSION_PREFIX.ADMIN}*`,
          'COUNT',
          100
        );
        cursor = result[0];

        for (const key of result[1]) {
          const sessionJson = await redisClient.get(key);
          if (sessionJson) {
            const session = JSON.parse(sessionJson) as SessionData;
            if (new Date(session.expiresAt) < new Date()) {
              await this.invalidateSession(session.sessionId, 'admin');
              cleaned++;
            }
          }
        }
      } while (cursor !== '0');

      if (cleaned > 0) {
        logger.info(`[SessionService] Cleaned up ${cleaned} expired sessions`);
      }

      return cleaned;
    } catch (error) {
      logger.error(`[SessionService] Error cleaning up sessions:`, error);
      return 0;
    }
  }
}

// Export singleton instance
const sessionService = new SessionService();
export default sessionService;

// Export class for testing
export { SessionService };
