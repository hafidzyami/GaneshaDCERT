import { Request, Response } from 'express';
import { PrismaClient, RequestStatus } from '@prisma/client';
import { validationResult } from 'express-validator';
import { generateMagicLinkToken, verifyMagicLinkToken, generateSessionToken } from '../utils/jwtService';
import { sendMagicLinkEmail } from '../utils/emailService';

const prisma = new PrismaClient();

export const registerInstitution = async (req: Request, res: Response): Promise<void> => {
  try {
    // Validasi input dari express-validator
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: errors.array(),
      });
      return;
    }

    const { name, email, phone, country, website, address } = req.body;

    // Cek apakah email sudah terdaftar
    const existingInstitution = await prisma.institutionRegistration.findUnique({
      where: { email },
    });

    if (existingInstitution) {
      res.status(409).json({
        success: false,
        message: 'Email sudah terdaftar',
      });
      return;
    }

    // Buat registrasi institusi baru dengan status PENDING
    const newInstitution = await prisma.institutionRegistration.create({
      data: {
        name,
        email,
        phone,
        country,
        website,
        address,
        status: RequestStatus.PENDING,
      },
    });

    res.status(201).json({
      success: true,
      message: 'Registrasi berhasil. Menunggu persetujuan admin.',
      data: {
        id: newInstitution.id,
        name: newInstitution.name,
        email: newInstitution.email,
        status: newInstitution.status,
      },
    });
  } catch (error) {
    console.error('Error in registerInstitution:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan server',
    });
  }
};

export const getPendingInstitutions = async (req: Request, res: Response): Promise<void> => {
  try {
    const pendingInstitutions = await prisma.institutionRegistration.findMany({
      where: {
        status: RequestStatus.PENDING,
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        country: true,
        website: true,
        address: true,
        status: true,
        createdAt: true,
      },
    });

    res.status(200).json({
      success: true,
      data: pendingInstitutions,
    });
  } catch (error) {
    console.error('Error in getPendingInstitutions:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan server',
    });
  }
};

export const getAllInstitutions = async (req: Request, res: Response): Promise<void> => {
  try {
    const { status } = req.query;

    const whereClause: any = {};
    if (status) {
      whereClause.status = status as RequestStatus;
    }

    const institutions = await prisma.institutionRegistration.findMany({
      where: whereClause,
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        country: true,
        website: true,
        address: true,
        status: true,
        approvedBy: true,
        approvedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.status(200).json({
      success: true,
      data: institutions,
    });
  } catch (error) {
    console.error('Error in getAllInstitutions:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan server',
    });
  }
};

export const approveInstitution = async (req: Request, res: Response): Promise<void> => {
  try {
    // Validasi input dari express-validator
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: errors.array(),
      });
      return;
    }

    const { institutionId } = req.params;
    const { approvedBy } = req.body;

    // Cek apakah institusi ada dan masih pending
    const institution = await prisma.institutionRegistration.findUnique({
      where: { id: institutionId },
    });

    if (!institution) {
      res.status(404).json({
        success: false,
        message: 'Institusi tidak ditemukan',
      });
      return;
    }

    if (institution.status !== RequestStatus.PENDING) {
      res.status(400).json({
        success: false,
        message: `Institusi sudah ${institution.status.toLowerCase()}`,
      });
      return;
    }

    // Update status menjadi APPROVED
    const updatedInstitution = await prisma.institutionRegistration.update({
      where: { id: institutionId },
      data: {
        status: RequestStatus.APPROVED,
        approvedBy,
        approvedAt: new Date(),
      },
    });

    // Generate JWT token untuk Magic Link
    const token = generateMagicLinkToken(institutionId, institution.email);

    // Hitung expiry time (24 jam dari sekarang)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    // Simpan magic link ke database
    const magicLink = await prisma.magicLink.create({
      data: {
        institutionId,
        token,
        expiresAt,
      },
    });

    // Buat URL magic link (sesuaikan dengan URL frontend Anda)
    const frontendUrl = process.env.FRONTEND_URL;
    const magicLinkUrl = `${frontendUrl}/auth/verify?token=${token}`;

    // Kirim email magic link
    await sendMagicLinkEmail({
      to: institution.email,
      name: institution.name,
      magicLink: magicLinkUrl,
    });

    res.status(200).json({
      success: true,
      message: 'Institusi berhasil disetujui dan magic link telah dikirim ke email',
      data: {
        id: updatedInstitution.id,
        name: updatedInstitution.name,
        email: updatedInstitution.email,
        status: updatedInstitution.status,
        approvedBy: updatedInstitution.approvedBy,
        approvedAt: updatedInstitution.approvedAt,
      },
    });
  } catch (error) {
    console.error('Error in approveInstitution:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan server',
    });
  }
};

/**
 * 5. REJECT INSTITUSI (untuk admin)
 * POST /api/auth/reject/:institutionId
 */
export const rejectInstitution = async (req: Request, res: Response): Promise<void> => {
  try {
    // Validasi input dari express-validator
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: errors.array(),
      });
      return;
    }

    const { institutionId } = req.params;

    // Cek apakah institusi ada dan masih pending
    const institution = await prisma.institutionRegistration.findUnique({
      where: { id: institutionId },
    });

    if (!institution) {
      res.status(404).json({
        success: false,
        message: 'Institusi tidak ditemukan',
      });
      return;
    }

    if (institution.status !== RequestStatus.PENDING) {
      res.status(400).json({
        success: false,
        message: `Institusi sudah ${institution.status.toLowerCase()}`,
      });
      return;
    }

    // Update status menjadi REJECTED
    const updatedInstitution = await prisma.institutionRegistration.update({
      where: { id: institutionId },
      data: {
        status: RequestStatus.REJECTED,
      },
    });

    res.status(200).json({
      success: true,
      message: 'Institusi berhasil ditolak',
      data: {
        id: updatedInstitution.id,
        name: updatedInstitution.name,
        email: updatedInstitution.email,
        status: updatedInstitution.status,
      },
    });
  } catch (error) {
    console.error('Error in rejectInstitution:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan server',
    });
  }
};

/**
 * 6. VERIFIKASI MAGIC LINK TOKEN
 * POST /api/auth/verify-magic-link
 */
export const verifyMagicLink = async (req: Request, res: Response): Promise<void> => {
  try {
    // Validasi input dari express-validator
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: errors.array(),
      });
      return;
    }

    const { token } = req.body;

    // Verifikasi JWT token
    const decoded = verifyMagicLinkToken(token);
    if (!decoded) {
      res.status(401).json({
        success: false,
        message: 'Token tidak valid atau sudah kadaluarsa',
      });
      return;
    }

    // Cek magic link di database
    const magicLink = await prisma.magicLink.findUnique({
      where: { token },
      include: {
        institution: true,
      },
    });

    if (!magicLink) {
      res.status(404).json({
        success: false,
        message: 'Magic link tidak ditemukan',
      });
      return;
    }

    // Cek apakah sudah digunakan
    if (magicLink.used) {
      res.status(400).json({
        success: false,
        message: 'Magic link sudah pernah digunakan',
      });
      return;
    }

    // Cek apakah sudah expired
    if (new Date() > magicLink.expiresAt) {
      res.status(400).json({
        success: false,
        message: 'Magic link sudah kadaluarsa',
      });
      return;
    }

    // Cek apakah institusi sudah approved
    if (magicLink.institution.status !== RequestStatus.APPROVED) {
      res.status(400).json({
        success: false,
        message: 'Institusi belum disetujui',
      });
      return;
    }

    // Tandai magic link sebagai sudah digunakan
    await prisma.magicLink.update({
      where: { id: magicLink.id },
      data: {
        used: true,
        usedAt: new Date(),
      },
    });

    // Generate session token
    const sessionToken = generateSessionToken(
      magicLink.institution.id,
      magicLink.institution.email
    );

    res.status(200).json({
      success: true,
      message: 'Login berhasil',
      data: {
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
      },
    });
  } catch (error) {
    console.error('Error in verifyMagicLink:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan server',
    });
  }
};

/**
 * 7. GET INSTITUTION PROFILE (dengan session token)
 * GET /api/auth/profile
 */
export const getProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    // Ambil institutionId dari middleware auth (akan kita buat nanti)
    const institutionId = (req as any).institutionId;

    const institution = await prisma.institutionRegistration.findUnique({
      where: { id: institutionId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        country: true,
        website: true,
        address: true,
        status: true,
        approvedBy: true,
        approvedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!institution) {
      res.status(404).json({
        success: false,
        message: 'Institusi tidak ditemukan',
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: institution,
    });
  } catch (error) {
    console.error('Error in getProfile:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan server',
    });
  }
};
