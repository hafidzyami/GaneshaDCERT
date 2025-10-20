import express, { Router } from 'express';
import {
  registerInstitution,
  getPendingInstitutions,
  getAllInstitutions,
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

// Register institution
router.post('/register', registerInstitutionValidator, registerInstitution);

// Get pending institutions (Admin only)
router.get('/pending-institutions', adminAuthMiddleware, getPendingInstitutions);

// Get all institutions (Admin only)
router.get('/institutions', adminAuthMiddleware, getAllInstitutionsValidator, getAllInstitutions);

// Approve institution (Admin only)
router.post('/approve/:institutionId', adminAuthMiddleware, approveInstitutionValidator, approveInstitution);

// Reject institution (Admin only)
router.post('/reject/:institutionId', adminAuthMiddleware, rejectInstitutionValidator, rejectInstitution);

// Verify magic link
router.post('/verify-magic-link', verifyMagicLinkValidator, verifyMagicLink);

// Get profile (Protected)
router.get('/profile', authMiddleware, getProfile);

export default router;
