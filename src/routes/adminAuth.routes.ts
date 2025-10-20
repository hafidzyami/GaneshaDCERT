import express, { Router } from "express";
import {
  adminLogin,
  getAdminProfile,
  createAdmin,
  changePassword,
} from "../controllers/adminAuth.controller";
import { adminAuthMiddleware } from "../middlewares/adminAuth.middleware";
import {
  adminLoginValidator,
  createAdminValidator,
  changePasswordValidator,
} from "../validators/adminAuth.validator";

const router: Router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Admin Authentication
 *   description: Admin authentication endpoints
 */

/**
 * @swagger
 * /admin/auth/login:
 *   post:
 *     summary: Admin login
 *     description: Login untuk admin dengan email dan password
 *     tags:
 *       - Admin Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: admin@ganeshadcert.com
 *               password:
 *                 type: string
 *                 format: password
 *                 example: Admin123!
 *     responses:
 *       200:
 *         description: Login berhasil
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
 *                     admin:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         email:
 *                           type: string
 *                         name:
 *                           type: string
 *       401:
 *         description: Email atau password salah
 *       400:
 *         description: Validation error
 *       500:
 *         description: Internal server error
 */
router.post("/login", adminLoginValidator, adminLogin);

/**
 * @swagger
 * /admin/auth/profile:
 *   get:
 *     summary: Get admin profile
 *     description: Mendapatkan data profil admin yang sedang login (Protected endpoint)
 *     tags:
 *       - Admin Authentication
 *     security:
 *       - AdminBearerAuth: []
 *     responses:
 *       200:
 *         description: Data profil admin
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Admin'
 *       401:
 *         description: Unauthorized - Token tidak valid atau tidak ada
 *       404:
 *         description: Admin tidak ditemukan
 *       500:
 *         description: Internal server error
 */
router.get("/profile", adminAuthMiddleware, getAdminProfile);

/**
 * @swagger
 * /admin/auth/create:
 *   post:
 *     summary: Create new admin
 *     description: Membuat admin baru (untuk seeding atau development)
 *     tags:
 *       - Admin Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - name
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: admin@ganeshadcert.com
 *               password:
 *                 type: string
 *                 format: password
 *                 example: Admin123!
 *               name:
 *                 type: string
 *                 example: Admin User
 *     responses:
 *       201:
 *         description: Admin berhasil dibuat
 *       409:
 *         description: Email sudah terdaftar
 *       400:
 *         description: Validation error
 *       500:
 *         description: Internal server error
 */
router.post("/create", createAdminValidator, createAdmin);

/**
 * @swagger
 * /admin/auth/change-password:
 *   post:
 *     summary: Change admin password
 *     description: Mengubah password admin (Protected endpoint)
 *     tags:
 *       - Admin Authentication
 *     security:
 *       - AdminBearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - currentPassword
 *               - newPassword
 *             properties:
 *               currentPassword:
 *                 type: string
 *                 format: password
 *               newPassword:
 *                 type: string
 *                 format: password
 *                 description: Password baru minimal 6 karakter
 *     responses:
 *       200:
 *         description: Password berhasil diubah
 *       401:
 *         description: Password lama salah atau unauthorized
 *       400:
 *         description: Validation error
 *       500:
 *         description: Internal server error
 */
router.post("/change-password", adminAuthMiddleware, changePasswordValidator, changePassword);

export default router;
