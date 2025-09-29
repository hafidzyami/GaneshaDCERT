import { Router } from 'express';
import { fetchNextRequest, issueCredential } from '../controllers/manualWorkerController';

const router = Router();
router.get('/next-request', fetchNextRequest);
router.post('/issue-vc', issueCredential);
export default router;