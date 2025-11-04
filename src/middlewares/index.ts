/**
 * Middlewares Index
 * Central export point for all middlewares
 */

export * from './auth.middleware';
export * from './adminAuth.middleware';
export * from './didAuth.middleware';
export * from './errorHandler.middleware';
export * from './requestLogger.middleware';
export * from './rateLimit.middleware';
export * from './upload.middleware';

// Export asyncHandler separately for convenience
export { asyncHandler } from './errorHandler.middleware';

// Export types
export type { RequestWithInstitution } from './auth.middleware';
export type { RequestWithDID } from './didAuth.middleware';
