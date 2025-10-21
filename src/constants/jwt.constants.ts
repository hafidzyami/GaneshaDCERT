/**
 * JWT Constants
 */

export const JWT_EXPIRY = {
  MAGIC_LINK: '24h',
  SESSION: '7d',
  ADMIN: '30d',
} as const;

export const JWT_TYPE = {
  MAGIC_LINK: 'magic-link',
  SESSION: 'session',
  ADMIN: 'admin',
} as const;
