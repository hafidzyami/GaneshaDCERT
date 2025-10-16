import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';
const MAGIC_LINK_EXPIRY = '24h'; // Magic link berlaku 24 jam

interface MagicLinkPayload {
  userId: string;
  email: string;
  type: 'magic-link';
}

interface DecodedMagicLink extends MagicLinkPayload {
  iat: number;
  exp: number;
}

/**
 * Generate JWT token untuk Magic Link
 */
export const generateMagicLinkToken = (userId: string, email: string): string => {
  const payload: MagicLinkPayload = {
    userId,
    email,
    type: 'magic-link',
  };

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: MAGIC_LINK_EXPIRY,
  });
};

/**
 * Verifikasi JWT token dari Magic Link
 */
export const verifyMagicLinkToken = (token: string): DecodedMagicLink | null => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as DecodedMagicLink;
    
    // Pastikan token adalah magic link token
    if (decoded.type !== 'magic-link') {
      return null;
    }
    
    return decoded;
  } catch (error) {
    console.error('Error verifying magic link token:', error);
    return null;
  }
};

/**
 * Generate session token setelah magic link diverifikasi
 */
export const generateSessionToken = (userId: string, email: string): string => {
  const payload = {
    userId,
    email,
    type: 'session',
  };

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: '7d', // Session berlaku 7 hari
  });
};

/**
 * Verifikasi session token
 */
export const verifySessionToken = (token: string): any => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
};
