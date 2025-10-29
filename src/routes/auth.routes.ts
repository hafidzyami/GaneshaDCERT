import express, { Router } from 'express';
import {
  registerInstitution,
  getPendingInstitutions,
  getAllRegistrationInstitutions,
  approveInstitution,
  rejectInstitution,
  verifyMagicLink,
  getProfile,
} from '../controllers/auth.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { adminAuthMiddleware } from '../middlewares/adminAuth.middleware';
import {
  registerInstitutionValidator,
  approveInstitutionValidator,
  rejectInstitutionValidator,
  verifyMagicLinkValidator,
  getAllInstitutionsValidator,
} from '../validators/auth.validator';

const router: Router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Authentication
 *   description: Magic Link Authentication endpoints
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Institution:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         name:
 *           type: string
 *         email:
 *           type: string
 *           format: email
 *         phone:
 *           type: string
 *         country:
 *           type: string
 *         website:
 *           type: string
 *           format: uri
 *         address:
 *           type: string
 *         status:
 *           type: string
 *           enum: [PENDING, APPROVED, REJECTED]
 *         approvedBy:
 *           type: string
 *           nullable: true
 *         approvedAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 */

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Register new institution
 *     description: Register a new institution for Magic Link authentication. Status will be PENDING until approved by admin.
 *     tags:
 *       - Authentication
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
 *                 example: Universitas Indonesia
 *                 description: Institution name
 *               email:
 *                 type: string
 *                 format: email
 *                 example: admin@ui.ac.id
 *                 description: Institution email
 *               phone:
 *                 type: string
 *                 example: +6281234567890
 *                 description: Institution phone number
 *               country:
 *                 type: string
 *                 example: Indonesia
 *                 description: Country name
 *               website:
 *                 type: string
 *                 format: uri
 *                 example: https://ui.ac.id
 *                 description: Institution website URL
 *               address:
 *                 type: string
 *                 example: Kampus UI Depok, Jawa Barat 16424
 *                 description: Institution address
 *     responses:
 *       201:
 *         description: Registration successful, waiting for admin approval
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Registrasi berhasil. Menunggu persetujuan admin.
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                     name:
 *                       type: string
 *                     email:
 *                       type: string
 *                     status:
 *                       type: string
 *                       example: PENDING
 *       400:
 *         description: Validation error or missing required fields
 *       409:
 *         description: Email already registered
 *       500:
 *         description: Internal server error
 */
router.post('/register', registerInstitutionValidator, registerInstitution);

/**
 * @swagger
 * /auth/pending-institutions:
 *   get:
 *     summary: Get all pending institutions
 *     description: Retrieve list of institutions waiting for approval (Admin endpoint)
 *     tags:
 *       - Authentication
 *     security:
 *       - AdminBearerAuth: []
 *     responses:
 *       200:
 *         description: List of pending institutions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Institution'
 *       401:
 *         description: Unauthorized - Token tidak valid atau tidak ada
 *       500:
 *         description: Internal server error
 */
router.get('/pending-institutions', adminAuthMiddleware, getPendingInstitutions);

/**
 * @swagger
 * /auth/institutions:
 *   get:
 *     summary: Get all institutions
 *     description: Retrieve list of all institutions with optional status filter (Admin endpoint)
 *     tags:
 *       - Authentication
 *     security:
 *       - AdminBearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, APPROVED, REJECTED]
 *         description: Filter institutions by status
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *         description: Number of items per page
 *     responses:
 *       200:
 *         description: List of institutions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Institution'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     total:
 *                       type: integer
 *       401:
 *         description: Unauthorized - Token tidak valid atau tidak ada
 *       500:
 *         description: Internal server error
 */
router.get('/institutions', adminAuthMiddleware, getAllInstitutionsValidator, getAllRegistrationInstitutions);

/**
 * @swagger
 * /auth/approve/{institutionId}:
 *   post:
 *     summary: Approve institution registration
 *     description: Approve pending institution registration and send magic link email (Admin endpoint)
 *     tags:
 *       - Authentication
 *     security:
 *       - AdminBearerAuth: []
 *     parameters:
 *       - in: path
 *         name: institutionId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Institution ID to approve
 *     responses:
 *       200:
 *         description: Institution approved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Institusi berhasil disetujui dan magic link telah dikirim
 *                 data:
 *                   $ref: '#/components/schemas/Institution'
 *       400:
 *         description: Institution already approved or rejected
 *       401:
 *         description: Unauthorized - Token tidak valid atau tidak ada
 *       404:
 *         description: Institution not found
 *       500:
 *         description: Internal server error
 */
router.post('/approve/:institutionId', adminAuthMiddleware, approveInstitutionValidator, approveInstitution);

/**
 * @swagger
 * /auth/reject/{institutionId}:
 *   post:
 *     summary: Reject institution registration
 *     description: Reject pending institution registration with reason (Admin endpoint)
 *     tags:
 *       - Authentication
 *     security:
 *       - AdminBearerAuth: []
 *     parameters:
 *       - in: path
 *         name: institutionId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Institution ID to reject
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - reason
 *             properties:
 *               reason:
 *                 type: string
 *                 example: Data institusi tidak valid
 *                 description: Reason for rejection
 *     responses:
 *       200:
 *         description: Institution rejected successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Institusi berhasil ditolak
 *                 data:
 *                   $ref: '#/components/schemas/Institution'
 *       400:
 *         description: Institution already approved or rejected
 *       401:
 *         description: Unauthorized - Token tidak valid atau tidak ada
 *       404:
 *         description: Institution not found
 *       500:
 *         description: Internal server error
 */
router.post('/reject/:institutionId', adminAuthMiddleware, rejectInstitutionValidator, rejectInstitution);

/**
 * @swagger
 * /auth/verify-magic-link:
 *   post:
 *     summary: Verify magic link token
 *     description: Verify magic link token and return JWT for authentication
 *     tags:
 *       - Authentication
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
 *                 example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *                 description: Magic link token from email
 *     responses:
 *       200:
 *         description: Magic link verified successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Login berhasil
 *                 data:
 *                   type: object
 *                   properties:
 *                     token:
 *                       type: string
 *                       description: JWT token untuk authentikasi
 *                     institution:
 *                       $ref: '#/components/schemas/Institution'
 *       400:
 *         description: Invalid or expired token
 *       404:
 *         description: Institution not found or not approved
 *       500:
 *         description: Internal server error
 */
router.post('/verify-magic-link', verifyMagicLinkValidator, verifyMagicLink);

/**
 * @swagger
 * /auth/profile:
 *   get:
 *     summary: Get institution profile
 *     description: Get logged in institution profile (Protected endpoint)
 *     tags:
 *       - Authentication
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Institution profile data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Institution'
 *       401:
 *         description: Unauthorized - Token tidak valid atau tidak ada
 *       404:
 *         description: Institution not found
 *       500:
 *         description: Internal server error
 */
router.get('/profile', authMiddleware, getProfile);

export default router;
