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

// Admin login
router.post("/login", adminLoginValidator, adminLogin);

// Get admin profile (Protected)
router.get("/profile", adminAuthMiddleware, getAdminProfile);

// Create new admin
router.post("/create", createAdminValidator, createAdmin);

// Change admin password (Protected)
router.post("/change-password", adminAuthMiddleware, changePasswordValidator, changePassword);

export default router;
