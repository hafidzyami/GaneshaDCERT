/**
 * Express Request Type Extensions
 * Extends Express Request interface with custom properties
 */

declare global {
  namespace Express {
    interface Request {
      // Institution authentication
      institutionId?: string;
      email?: string;
      
      // Admin authentication
      adminId?: string;
      adminEmail?: string;
      adminName?: string;
      
      // Request tracking
      requestId?: string;
      startTime?: number;
    }
  }
}

export {};
