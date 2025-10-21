import { Admin, PrismaClient } from "@prisma/client";
import { prisma } from "../config/database";
import { env } from "../config/env";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import {
  ConflictError,
  NotFoundError,
  UnauthorizedError,
} from "../utils/errors/AppError";
import logger from "../config/logger";

/**
 * Admin Authentication Service with Dependency Injection
 * Handles admin login, profile, and password management
 */
class AdminAuthService {
  private db: PrismaClient;
  private jwtSecret: string;
  private jwtExpiresIn: string | number;
  private saltRounds: number;

  /**
   * Constructor with dependency injection
   * @param dependencies - Optional dependencies for testing
   */
  constructor(dependencies?: {
    db?: PrismaClient;
    jwtSecret?: string;
    jwtExpiresIn?: string | number;
    saltRounds?: number;
  }) {
    this.db = dependencies?.db || prisma;
    this.jwtSecret = dependencies?.jwtSecret || env.JWT_SECRET;
    this.jwtExpiresIn = dependencies?.jwtExpiresIn || "7d";
    this.saltRounds = dependencies?.saltRounds || 10;
  }

  /**
   * Admin login
   */
  async login(email: string, password: string): Promise<{ token: string; admin: Partial<Admin> }> {
    // Find admin by email
    const admin = await this.db.admin.findUnique({
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

    const token = jwt.sign(tokenPayload, this.jwtSecret, {
      expiresIn: this.jwtExpiresIn as string,
    } as jwt.SignOptions);

    logger.success(`Admin logged in: ${admin.email}`);

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
    const admin = await this.db.admin.findUnique({
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
    const existingAdmin = await this.db.admin.findUnique({
      where: { email: data.email },
    });

    if (existingAdmin) {
      throw new ConflictError("Email sudah terdaftar");
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(data.password, this.saltRounds);

    // Create admin
    const newAdmin = await this.db.admin.create({
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

    logger.success(`Admin created: ${newAdmin.email}`);

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
    const admin = await this.db.admin.findUnique({
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
    const hashedNewPassword = await bcrypt.hash(newPassword, this.saltRounds);

    // Update password
    await this.db.admin.update({
      where: { id: adminId },
      data: {
        password: hashedNewPassword,
      },
    });

    logger.success(`Password changed for admin: ${admin.email}`);
  }
}

// Export singleton instance for backward compatibility
export default new AdminAuthService();

// Export class for testing and custom instantiation
export { AdminAuthService };
