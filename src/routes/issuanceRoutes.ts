// src/routes/issuanceRoutes.ts
import { Router } from 'express';
import { requestVcIssuance } from '../controllers/issuanceController';

const router = Router();
router.post('/', requestVcIssuance);
export default router;