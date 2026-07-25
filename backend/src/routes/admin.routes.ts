import { Router } from 'express';
import { getUserCount, getAdminStats, checkAdmin } from '../controllers/admin.controller';
import { isAdmin } from '../middleware/admin.middleware';

const router = Router();

// Public — just the count
router.get('/user-count', getUserCount);

// Public — check if current user is admin
router.get('/check', checkAdmin);

// Admin-only — full stats with user list
router.get('/stats', isAdmin, getAdminStats);

export default router;
