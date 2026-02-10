import express from 'express';
import { createMembership, updateMembership, expireMembership } from '../controllers/adminController';
import { auth, authorize } from '../middleware/auth';

const router = express.Router();

// Create membership for user
router.post('/membership/:userId', auth, authorize('admin'), createMembership);

// Update membership for user
router.put('/membership/:userId', auth, authorize('admin'), updateMembership);

// Expire membership for user
router.put('/membership/:userId/expire', auth, authorize('admin'), expireMembership);

export default router;
