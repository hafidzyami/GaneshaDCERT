import express from 'express';
import {
  registerInstitution,
  getPendingInstitutions,
  getAllInstitutions,
  approveInstitution,
  rejectInstitution,
  verifyMagicLink,
  getProfile,
} from '../controllers/auth';
import { authMiddleware } from '../middlewares/auth';

const router = express.Router();

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Registrasi institusi baru
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *               - phone
 *               - country
 *               - website
 *               - address
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *               phone:
 *                 type: string
 *               country:
 *                 type: string
 *               website:
 *                 type: string
 *               address:
 *                 type: string
 *     responses:
 *       201:
 *         description: Registrasi berhasil
 */
router.post('/register', registerInstitution);

/**
 * @swagger
 * /api/auth/pending-institutions:
 *   get:
 *     summary: Mendapatkan daftar institusi yang menunggu persetujuan (Admin)
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Daftar institusi pending
 */
router.get('/pending-institutions', getPendingInstitutions);

/**
 * @swagger
 * /api/auth/institutions:
 *   get:
 *     summary: Mendapatkan semua institusi (Admin)
 *     tags: [Auth]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, APPROVED, REJECTED]
 *         description: Filter berdasarkan status
 *     responses:
 *       200:
 *         description: Daftar institusi
 */
router.get('/institutions', getAllInstitutions);

/**
 * @swagger
 * /api/auth/approve/{institutionId}:
 *   post:
 *     summary: Approve institusi dan kirim magic link (Admin)
 *     tags: [Auth]
 *     parameters:
 *       - in: path
 *         name: institutionId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - approvedBy
 *             properties:
 *               approvedBy:
 *                 type: string
 *     responses:
 *       200:
 *         description: Institusi berhasil disetujui
 */
router.post('/approve/:institutionId', approveInstitution);

/**
 * @swagger
 * /api/auth/reject/{institutionId}:
 *   post:
 *     summary: Reject institusi (Admin)
 *     tags: [Auth]
 *     parameters:
 *       - in: path
 *         name: institutionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Institusi berhasil ditolak
 */
router.post('/reject/:institutionId', rejectInstitution);

/**
 * @swagger
 * /api/auth/verify-magic-link:
 *   post:
 *     summary: Verifikasi magic link token dan dapatkan session token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *             properties:
 *               token:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login berhasil
 */
router.post('/verify-magic-link', verifyMagicLink);

/**
 * @swagger
 * /api/auth/profile:
 *   get:
 *     summary: Mendapatkan profil institusi (Protected)
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Data profil institusi
 */
router.get('/profile', authMiddleware, getProfile);

export default router;
