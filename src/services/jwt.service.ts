import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { JWT_EXPIRY, JWT_TYPE } from '../constants';
import {
  MagicLinkPayload,
  SessionPayload,
  AdminPayload,
  DecodedMagicLink,
  DecodedSession,
  DecodedAdmin,
} from '../types';

/**
 * JWT Service
 * Handles JWT token generation and verification
 */

/**
 * Generate JWT token for Magic Link
 */
export const generateMagicLinkToken = (userId: string, email: string): string => {
  const payload: MagicLinkPayload = {
    userId,
    email,
    type: JWT_TYPE.MAGIC_LINK,
  };

  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: JWT_EXPIRY.MAGIC_LINK,
  });
};

/**
 * Verify JWT token from Magic Link
 */
export const verifyMagicLinkToken = (token: string): DecodedMagicLink | null => {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as DecodedMagicLink;

    // Ensure token is magic link token
    if (decoded.type !== JWT_TYPE.MAGIC_LINK) {
      return null;
    }

    return decoded;
  } catch (error) {
    return null;
  }
};

/**
 * Generate session token after magic link verification
 */
export const generateSessionToken = (userId: string, email: string): string => {
  const payload: SessionPayload = {
    userId,
    email,
    type: JWT_TYPE.SESSION,
  };

  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: JWT_EXPIRY.SESSION,
  });
};

/**
 * Verify session token
 */
export const verifySessionToken = (token: string): DecodedSession | null => {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as DecodedSession;

    // Ensure token is session token
    if (decoded.type !== JWT_TYPE.SESSION) {
      return null;
    }

    return decoded;
  } catch (error) {
    return null;
  }
};

/**
 * Generate admin token
 */
export const generateAdminToken = (id: string, email: string, name: string): string => {
  const payload: AdminPayload = {
    id,
    email,
    name,
    role: 'admin',
  };

  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: JWT_EXPIRY.ADMIN,
  });
};

/**
 * Verify admin token
 */
export const verifyAdminToken = (token: string): DecodedAdmin | null => {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as DecodedAdmin;

    // Ensure token is admin token
    if (decoded.role !== 'admin') {
      return null;
    }

    return decoded;
  } catch (error) {
    return null;
  }
};
