import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';

interface AdminJwtPayload {
  id: string;
  email: string;
  name: string;
  role: string;
}

/**
 * Middleware untuk verifikasi admin authentication
 */
export const adminAuthMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Ambil token dari header Authorization
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        message: 'Token tidak ditemukan. Silakan login terlebih dahulu.',
      });
      return;
    }

    const token = authHeader.substring(7); // Hilangkan "Bearer "

    // Verifikasi token
    const decoded = jwt.verify(token, JWT_SECRET) as AdminJwtPayload;

    // Cek apakah role adalah admin
    if (decoded.role !== 'admin') {
      res.status(403).json({
        success: false,
        message: 'Akses ditolak. Hanya admin yang diizinkan.',
      });
      return;
    }

    // Simpan admin info ke request object
    (req as any).adminId = decoded.id;
    (req as any).adminEmail = decoded.email;
    (req as any).adminName = decoded.name;

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({
        success: false,
        message: 'Token sudah kadaluarsa. Silakan login kembali.',
      });
      return;
    }

    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({
        success: false,
        message: 'Token tidak valid.',
      });
      return;
    }

    console.error('Error in adminAuthMiddleware:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan server',
    });
  }
};
