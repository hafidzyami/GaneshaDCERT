import express, { Router } from 'express';
import { body, param, query } from 'express-validator';
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
router.post(
  '/register',
  [
    body('name', 'Name is required and must not be empty')
      .trim()
      .notEmpty(),
    body('email', 'Email is required and must be valid')
      .trim()
      .isEmail()
      .normalizeEmail(),
    body('phone', 'Phone is required and must not be empty')
      .trim()
      .notEmpty(),
    body('country', 'Country is required and must not be empty')
      .trim()
      .notEmpty(),
    body('website', 'Website must be a valid URL')
      .trim()
      .isURL(),
    body('address', 'Address is required and must not be empty')
      .trim()
      .notEmpty(),
  ],
  registerInstitution
);

/**
 * @swagger
 * /auth/pending-institutions:
 *   get:
 *     summary: Get all pending institutions
 *     description: Retrieve list of institutions waiting for approval (Admin endpoint)
 *     tags:
 *       - Authentication
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
 *       500:
 *         description: Internal server error
 */
router.get('/pending-institutions', getPendingInstitutions);

/**
 * @swagger
 * /auth/institutions:
 *   get:
 *     summary: Get all institutions
 *     description: Retrieve list of all institutions with optional status filter (Admin endpoint)
 *     tags:
 *       - Authentication
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, APPROVED, REJECTED]
 *         description: Filter institutions by status
 *         example: APPROVED
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
 *       500:
 *         description: Internal server error
 */
router.get(
  '/institutions',
  [
    query('status')
      .optional()
      .isIn(['PENDING', 'APPROVED', 'REJECTED'])
      .withMessage('Status must be PENDING, APPROVED, or REJECTED'),
  ],
  getAllInstitutions
);

/**
 * @swagger
 * /auth/approve/{institutionId}:
 *   post:
 *     summary: Approve institution and send magic link
 *     description: Approve pending institution registration and automatically send magic link to their email (Admin endpoint)
 *     tags:
 *       - Authentication
 *     parameters:
 *       - in: path
 *         name: institutionId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Institution ID
 *         example: 550e8400-e29b-41d4-a716-446655440000
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
 *                 example: Admin User
 *                 description: Name of admin who approved the registration
 *     responses:
 *       200:
 *         description: Institution approved and magic link sent successfully
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
 *                   example: Institusi berhasil disetujui dan magic link telah dikirim ke email
 *                 data:
 *                   $ref: '#/components/schemas/Institution'
 *       400:
 *         description: Institution already approved/rejected or validation error
 *       404:
 *         description: Institution not found
 *       500:
 *         description: Internal server error
 */
router.post(
  '/approve/:institutionId',
  [
    param('institutionId', 'Invalid institution ID')
      .trim()
      .isUUID(),
    body('approvedBy', 'approvedBy is required')
      .trim()
      .notEmpty(),
  ],
  approveInstitution
);

/**
 * @swagger
 * /auth/reject/{institutionId}:
 *   post:
 *     summary: Reject institution registration
 *     description: Reject pending institution registration (Admin endpoint)
 *     tags:
 *       - Authentication
 *     parameters:
 *       - in: path
 *         name: institutionId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Institution ID
 *         example: 550e8400-e29b-41d4-a716-446655440000
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
 *         description: Institution already approved/rejected
 *       404:
 *         description: Institution not found
 *       500:
 *         description: Internal server error
 */
router.post(
  '/reject/:institutionId',
  [
    param('institutionId', 'Invalid institution ID')
      .trim()
      .isUUID(),
  ],
  rejectInstitution
);

/**
 * @swagger
 * /auth/verify-magic-link:
 *   post:
 *     summary: Verify magic link token
 *     description: Verify magic link token from email and get session token for authentication
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
 *                 description: Magic link JWT token from email
 *     responses:
 *       200:
 *         description: Login successful, returns session token
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
 *                     sessionToken:
 *                       type: string
 *                       description: JWT session token (valid for 7 days)
 *                       example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *                     institution:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         name:
 *                           type: string
 *                         email:
 *                           type: string
 *                         phone:
 *                           type: string
 *                         country:
 *                           type: string
 *                         website:
 *                           type: string
 *                         address:
 *                           type: string
 *       400:
 *         description: Magic link already used or expired
 *       401:
 *         description: Invalid or expired token
 *       404:
 *         description: Magic link not found
 *       500:
 *         description: Internal server error
 */
router.post(
  '/verify-magic-link',
  [
    body('token', 'Token is required')
      .trim()
      .notEmpty(),
  ],
  verifyMagicLink
);

/**
 * @swagger
 * /auth/profile:
 *   get:
 *     summary: Get institution profile
 *     description: Get authenticated institution profile (Protected endpoint - requires session token)
 *     tags:
 *       - Authentication
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Institution profile retrieved successfully
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
 *         description: Unauthorized - Invalid or missing token
 *       404:
 *         description: Institution not found
 *       500:
 *         description: Internal server error
 */
router.get('/profile', authMiddleware, getProfile);

export default router;
