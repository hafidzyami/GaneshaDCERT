import { Request, Response, NextFunction } from 'express';
import { verifySessionToken } from '../services';
import { HTTP_STATUS } from '../constants';
import { logger } from '../config';

/**
 * Authentication Middleware
 * Verifies session token and attaches user info to request
 */
export const authMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: 'Token tidak ditemukan',
      });
      return;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify token
    const decoded = verifySessionToken(token);

    if (!decoded) {
      res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: 'Token tidak valid atau sudah kadaluarsa',
      });
      return;
    }

    // Attach decoded data to request
    req.institutionId = decoded.userId;
    req.email = decoded.email;

    logger.debug('Authentication successful', {
      institutionId: decoded.userId,
      email: decoded.email,
    });

    next();
  } catch (error) {
    logger.error('Error in authMiddleware', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Terjadi kesalahan server',
    });
  }
};
