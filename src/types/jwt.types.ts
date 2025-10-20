/**
 * JWT Type Definitions
 */

export interface MagicLinkPayload {
  userId: string;
  email: string;
  type: 'magic-link';
}

export interface SessionPayload {
  userId: string;
  email: string;
  type: 'session';
}

export interface AdminPayload {
  id: string;
  email: string;
  name: string;
  role: 'admin';
}

export interface DecodedMagicLink extends MagicLinkPayload {
  iat: number;
  exp: number;
}

export interface DecodedSession extends SessionPayload {
  iat: number;
  exp: number;
}

export interface DecodedAdmin extends AdminPayload {
  iat: number;
  exp: number;
}

export type JWTPayload = MagicLinkPayload | SessionPayload | AdminPayload;
export type DecodedJWT = DecodedMagicLink | DecodedSession | DecodedAdmin;
