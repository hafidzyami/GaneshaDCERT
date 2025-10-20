import { Admin } from "@prisma/client";
import { prisma } from "../config/database";
import { env } from "../config/env";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import {
  ConflictError,
  NotFoundError,
  UnauthorizedError,
} from "../utils/errors/AppError";

/**
 * Admin Authentication Service
 * Handles admin login, profile, and password management
 */
class AdminAuthService {
  private readonly JWT_SECRET: string;
  private readonly JWT_EXPIRES_IN: string | number;
  private readonly SALT_ROUNDS: number = 10;

  constructor() {
    this.JWT_SECRET = env.JWT_SECRET;
    this.JWT_EXPIRES_IN = "7d";
  }

  /**
   * Admin login
   */
  async login(email: string, password: string): Promise<{ token: string; admin: Partial<Admin> }> {
    // Find admin by email
    const admin = await prisma.admin.findUnique({
      where: { email },
    });

    if (!admin) {
      throw new UnauthorizedError("Email atau password salah");
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, admin.password);

    if (!isPasswordValid) {
      throw new UnauthorizedError("Email atau password salah");
    }

    // Generate JWT token
    const tokenPayload = {
      id: admin.id,
      email: admin.email,
      name: admin.name,
      role: "admin",
    };

    const token = jwt.sign(tokenPayload, this.JWT_SECRET, {
      expiresIn: this.JWT_EXPIRES_IN as string,
    } as jwt.SignOptions);

    console.log(`✅ Admin logged in: ${admin.email}`);

    return {
      token,
      admin: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
      },
    };
  }

  /**
   * Get admin profile
   */
  async getProfile(adminId: string): Promise<Partial<Admin>> {
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
      throw new NotFoundError("Admin tidak ditemukan");
    }

    return admin;
  }

  /**
   * Create new admin
   */
  async createAdmin(data: {
    email: string;
    password: string;
    name: string;
  }): Promise<Partial<Admin>> {
    // Check if email already exists
    const existingAdmin = await prisma.admin.findUnique({
      where: { email: data.email },
    });

    if (existingAdmin) {
      throw new ConflictError("Email sudah terdaftar");
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(data.password, this.SALT_ROUNDS);

    // Create admin
    const newAdmin = await prisma.admin.create({
      data: {
        email: data.email,
        password: hashedPassword,
        name: data.name,
      },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
      },
    });

    console.log(`✅ Admin created: ${newAdmin.email}`);

    return newAdmin;
  }

  /**
   * Change admin password
   */
  async changePassword(
    adminId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    // Find admin
    const admin = await prisma.admin.findUnique({
      where: { id: adminId },
    });

    if (!admin) {
      throw new NotFoundError("Admin tidak ditemukan");
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(
      currentPassword,
      admin.password
    );

    if (!isCurrentPasswordValid) {
      throw new UnauthorizedError("Password lama salah");
    }

    // Hash new password
    const hashedNewPassword = await bcrypt.hash(newPassword, this.SALT_ROUNDS);

    // Update password
    await prisma.admin.update({
      where: { id: adminId },
      data: {
        password: hashedNewPassword,
      },
    });

    console.log(`✅ Password changed for admin: ${admin.email}`);
  }
}

export default new AdminAuthService();
