import { Request, Response, NextFunction } from 'express';
import { verifySessionToken } from '../services/jwt.service';

/**
 * Middleware untuk verifikasi session token
 */
export const authMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  try {
    // Ambil token dari header Authorization
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        message: 'Token tidak ditemukan',
      });
      return;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verifikasi token
    const decoded = verifySessionToken(token);

    if (!decoded) {
      res.status(401).json({
        success: false,
        message: 'Token tidak valid atau sudah kadaluarsa',
      });
      return;
    }

    // Simpan data decoded ke request untuk digunakan di controller
    (req as any).institutionId = decoded.userId;
    (req as any).email = decoded.email;

    next();
  } catch (error) {
    console.error('Error in authMiddleware:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan server',
    });
  }
};

/**
 * Middleware untuk admin (opsional - jika Anda ingin membedakan admin dan user biasa)
 */
export const adminMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  // Implementasi sesuai kebutuhan Anda
  // Misalnya: cek apakah user adalah admin berdasarkan role
  next();
};
