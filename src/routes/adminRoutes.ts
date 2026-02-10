import express from 'express';
import { createMembership, updateMembership, expireMembership } from '../controllers/adminController';
import { protect, authorize } from '../middleware/auth';

const router = express.Router();

// Create membership for user
router.post('/membership/:userId', protect, authorize('admin'), createMembership);

// Update membership for user
router.put('/membership/:userId', protect, authorize('admin'), updateMembership);

// Expire membership for user
router.put('/membership/:userId/expire', protect, authorize('admin'), expireMembership);

export default router;
