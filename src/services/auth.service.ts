import { InstitutionRegistration, PrismaClient } from "@prisma/client";
import { prisma } from "../config/database";
import {
  ConflictError,
  NotFoundError,
  BadRequestError,
} from "../utils/errors/AppError";
import {
  generateMagicLinkToken,
  verifyMagicLinkToken,
  generateSessionToken,
} from "./jwt.service";
import { sendMagicLinkEmail } from "./email.service";
import { env } from "../config/env";
import { REQUEST_STATUS } from "../constants";
import logger from "../config/logger";

/**
 * Authentication Service with Dependency Injection
 * Handles institution registration, approval, and magic link authentication
 */
class AuthService {
  private db: PrismaClient;
  private emailService: typeof sendMagicLinkEmail;
  private jwtService: {
    generateMagicLinkToken: typeof generateMagicLinkToken;
    verifyMagicLinkToken: typeof verifyMagicLinkToken;
    generateSessionToken: typeof generateSessionToken;
  };

  /**
   * Constructor with dependency injection
   * @param dependencies - Optional dependencies for testing
   */
  constructor(dependencies?: {
    db?: PrismaClient;
    emailService?: typeof sendMagicLinkEmail;
    jwtService?: {
      generateMagicLinkToken: typeof generateMagicLinkToken;
      verifyMagicLinkToken: typeof verifyMagicLinkToken;
      generateSessionToken: typeof generateSessionToken;
    };
  }) {
    this.db = dependencies?.db || prisma;
    this.emailService = dependencies?.emailService || sendMagicLinkEmail;
    this.jwtService = dependencies?.jwtService || {
      generateMagicLinkToken,
      verifyMagicLinkToken,
      generateSessionToken,
    };
  }

  /**
   * Register new institution
   */
  async registerInstitution(data: {
    name: string;
    email: string;
    phone: string;
    country: string;
    website: string;
    address: string;
  }): Promise<InstitutionRegistration> {
    // Check if email already exists
    const existing = await this.db.institutionRegistration.findUnique({
      where: { email: data.email },
    });

    if (existing) {
      throw new ConflictError("Email sudah terdaftar");
    }

    // Create new registration
    const institution = await this.db.institutionRegistration.create({
      data: {
        ...data,
        status: REQUEST_STATUS.PENDING as any,
      },
    });

    logger.info(`Institution registered: ${institution.name} (${institution.email})`);
    return institution;
  }

  /**
   * Get pending institutions
   */
  async getPendingInstitutions(): Promise<InstitutionRegistration[]> {
    return await this.db.institutionRegistration.findMany({
      where: { status: REQUEST_STATUS.PENDING as any },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * Get all institutions with optional status filter
   */
  async getAllRegistrationInstitutions(status?: string): Promise<InstitutionRegistration[]> {
    const whereClause = status ? { status: status as any } : {};

    return await this.db.institutionRegistration.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * Approve institution and send magic link
   */
  async approveInstitution(
    institutionId: string,
    approvedBy: string
  ): Promise<InstitutionRegistration> {
    // Check if institution exists
    const institution = await this.db.institutionRegistration.findUnique({
      where: { id: institutionId },
    });

    if (!institution) {
      throw new NotFoundError("Institusi tidak ditemukan");
    }

    if (institution.status !== REQUEST_STATUS.PENDING) {
      throw new BadRequestError(
        `Institusi sudah ${institution.status.toLowerCase()}`
      );
    }

    // Update status to APPROVED
    const updatedInstitution = await this.db.institutionRegistration.update({
      where: { id: institutionId },
      data: {
        status: REQUEST_STATUS.APPROVED as any,
        approvedBy,
        approvedAt: new Date(),
      },
    });

    // Generate magic link token
    const token = this.jwtService.generateMagicLinkToken(institutionId, institution.email);

    // Calculate expiry (24 hours)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    // Save magic link to database
    await this.db.magicLink.create({
      data: {
        institutionId,
        token,
        expiresAt,
      },
    });

    // Send magic link email
    const magicLinkUrl = `${env.FRONTEND_URL}/auth/verify?token=${token}`;
    await this.emailService({
      to: institution.email,
      name: institution.name,
      magicLink: magicLinkUrl,
    });

    logger.success(`Institution approved: ${institution.name}`);
    logger.info(`Magic link sent to: ${institution.email}`);

    return updatedInstitution;
  }

  /**
   * Reject institution
   */
  async rejectInstitution(institutionId: string): Promise<InstitutionRegistration> {
    // Check if institution exists
    const institution = await this.db.institutionRegistration.findUnique({
      where: { id: institutionId },
    });

    if (!institution) {
      throw new NotFoundError("Institusi tidak ditemukan");
    }

    if (institution.status !== REQUEST_STATUS.PENDING) {
      throw new BadRequestError(
        `Institusi sudah ${institution.status.toLowerCase()}`
      );
    }

    // Update status to REJECTED
    const updatedInstitution = await this.db.institutionRegistration.update({
      where: { id: institutionId },
      data: { status: REQUEST_STATUS.REJECTED as any },
    });

    logger.warn(`Institution rejected: ${institution.name}`);
    return updatedInstitution;
  }

  /**
   * Verify magic link token and return session token
   */
  async verifyMagicLink(token: string): Promise<{
    sessionToken: string;
    institution: Partial<InstitutionRegistration>;
  }> {
    // Verify JWT token
    const decoded = this.jwtService.verifyMagicLinkToken(token);
    if (!decoded) {
      throw new BadRequestError("Token tidak valid atau sudah kadaluarsa");
    }

    // Check magic link in database
    const magicLink = await this.db.magicLink.findUnique({
      where: { token },
      include: { institution: true },
    });

    if (!magicLink) {
      throw new NotFoundError("Magic link tidak ditemukan");
    }

    if (magicLink.used) {
      throw new BadRequestError("Magic link sudah pernah digunakan");
    }

    if (new Date() > magicLink.expiresAt) {
      throw new BadRequestError("Magic link sudah kadaluarsa");
    }

    if (magicLink.institution.status !== REQUEST_STATUS.APPROVED) {
      throw new BadRequestError("Institusi belum disetujui");
    }

    // Mark magic link as used
    await this.db.magicLink.update({
      where: { id: magicLink.id },
      data: {
        used: true,
        usedAt: new Date(),
      },
    });

    // Generate session token
    const sessionToken = this.jwtService.generateSessionToken(
      magicLink.institution.id,
      magicLink.institution.email
    );

    logger.success(`Magic link verified: ${magicLink.institution.email}`);

    return {
      sessionToken,
      institution: {
        id: magicLink.institution.id,
        name: magicLink.institution.name,
        email: magicLink.institution.email,
        phone: magicLink.institution.phone,
        country: magicLink.institution.country,
        website: magicLink.institution.website,
        address: magicLink.institution.address,
      },
    };
  }

  /**
   * Get institution profile by ID
   */
  async getInstitutionProfile(institutionId: string): Promise<InstitutionRegistration> {
    const institution = await this.db.institutionRegistration.findUnique({
      where: { id: institutionId },
    });

    if (!institution) {
      throw new NotFoundError("Institusi tidak ditemukan");
    }

    return institution;
  }
}

// Export singleton instance for backward compatibility
export default new AuthService();

// Export class for testing and custom instantiation
export { AuthService };
