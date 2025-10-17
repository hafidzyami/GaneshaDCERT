import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { validationResult } from 'express-validator';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

// Secret key untuk JWT - sebaiknya di .env
const JWT_SECRET: string = process.env.JWT_SECRET || 'your-secret-key-change-this';
const JWT_EXPIRES_IN: string = process.env.JWT_EXPIRES_IN || '7d';

/**
 * LOGIN ADMIN
 * POST /api/admin/auth/login
 */
export const adminLogin = async (req: Request, res: Response): Promise<void> => {
  try {
    // Validasi input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: errors.array(),
      });
      return;
    }

    const { email, password } = req.body;

    // Cari admin berdasarkan email
    const admin = await prisma.admin.findUnique({
      where: { email },
    });

    if (!admin) {
      res.status(401).json({
        success: false,
        message: 'Email atau password salah',
      });
      return;
    }

    // Verifikasi password dengan bcrypt
    const isPasswordValid = await bcrypt.compare(password, admin.password);

    if (!isPasswordValid) {
      res.status(401).json({
        success: false,
        message: 'Email atau password salah',
      });
      return;
    }

    // Generate JWT token
    const tokenPayload = {
      id: admin.id,
      email: admin.email,
      name: admin.name,
      role: 'admin',
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions);

    res.status(200).json({
      success: true,
      message: 'Login berhasil',
      data: {
        token,
        admin: {
          id: admin.id,
          email: admin.email,
          name: admin.name,
        },
      },
    });
  } catch (error) {
    console.error('Error in adminLogin:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan server',
    });
  }
};

/**
 * GET ADMIN PROFILE
 * GET /api/admin/auth/profile
 */
export const getAdminProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    // Admin ID dari middleware auth
    const adminId = (req as any).adminId;

    const admin = await prisma.admin.findUnique({
      where: { id: adminId },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!admin) {
      res.status(404).json({
        success: false,
        message: 'Admin tidak ditemukan',
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: admin,
    });
  } catch (error) {
    console.error('Error in getAdminProfile:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan server',
    });
  }
};

/**
 * CREATE ADMIN (untuk seeding pertama kali)
 * POST /api/admin/auth/create
 * Endpoint ini sebaiknya diproteksi atau hanya untuk development
 */
export const createAdmin = async (req: Request, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: errors.array(),
      });
      return;
    }

    const { email, password, name } = req.body;

    // Cek apakah email sudah ada
    const existingAdmin = await prisma.admin.findUnique({
      where: { email },
    });

    if (existingAdmin) {
      res.status(409).json({
        success: false,
        message: 'Email sudah terdaftar',
      });
      return;
    }

    // Hash password dengan bcrypt (10 salt rounds)
    const hashedPassword = await bcrypt.hash(password, 10);

    // Buat admin baru
    const newAdmin = await prisma.admin.create({
      data: {
        email,
        password: hashedPassword,
        name,
      },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
      },
    });

    res.status(201).json({
      success: true,
      message: 'Admin berhasil dibuat',
      data: newAdmin,
    });
  } catch (error) {
    console.error('Error in createAdmin:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan server',
    });
  }
};

/**
 * CHANGE PASSWORD
 * POST /api/admin/auth/change-password
 */
export const changePassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: errors.array(),
      });
      return;
    }

    const adminId = (req as any).adminId;
    const { currentPassword, newPassword } = req.body;

    // Cari admin
    const admin = await prisma.admin.findUnique({
      where: { id: adminId },
    });

    if (!admin) {
      res.status(404).json({
        success: false,
        message: 'Admin tidak ditemukan',
      });
      return;
    }

    // Verifikasi password lama
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, admin.password);

    if (!isCurrentPasswordValid) {
      res.status(401).json({
        success: false,
        message: 'Password lama salah',
      });
      return;
    }

    // Hash password baru
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    await prisma.admin.update({
      where: { id: adminId },
      data: {
        password: hashedNewPassword,
      },
    });

    res.status(200).json({
      success: true,
      message: 'Password berhasil diubah',
    });
  } catch (error) {
    console.error('Error in changePassword:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan server',
    });
  }
};
