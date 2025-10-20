import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { HTTP_STATUS } from '../constants';
import { DecodedAdmin } from '../types';
import logger from '../config/logger';

/**
 * Admin Authentication Middleware
 * Verifies admin token and attaches admin info to request
 */
export const adminAuthMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: 'Token tidak ditemukan. Silakan login terlebih dahulu.',
      });
      return;
    }

    const token = authHeader.substring(7); // Remove "Bearer "

    // Verify token
    const decoded = jwt.verify(token, env.JWT_SECRET) as DecodedAdmin;

    // Check if role is admin
    if (decoded.role !== 'admin') {
      res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        message: 'Akses ditolak. Hanya admin yang diizinkan.',
      });
      return;
    }

    // Attach admin info to request
    req.adminId = decoded.id;
    req.adminEmail = decoded.email;
    req.adminName = decoded.name;

    logger.debug('Admin authentication successful', {
      adminId: decoded.id,
      adminEmail: decoded.email,
    });

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: 'Token sudah kadaluarsa. Silakan login kembali.',
      });
      return;
    }

    if (error instanceof jwt.JsonWebTokenError) {
      res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: 'Token tidak valid.',
      });
      return;
    }

    logger.error('Error in adminAuthMiddleware', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Terjadi kesalahan server',
    });
  }
};
