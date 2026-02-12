import express from 'express';
import {
    createMembership,
    updateMembership,
    expireMembership,
    updateUser,
    toggleUserStatus,
    deleteUser
} from '../controllers/adminController';
import { protect, authorize } from '../middleware/auth';

const router = express.Router();

// Membership Management
router.post('/membership/:userId', protect, authorize('admin'), createMembership);
router.put('/membership/:userId', protect, authorize('admin'), updateMembership);
router.put('/membership/:userId/expire', protect, authorize('admin'), expireMembership);

// User Profile Management
router.put('/user/:userId', protect, authorize('admin'), updateUser);
router.patch('/user/:userId/toggle-status', protect, authorize('admin'), toggleUserStatus);
router.delete('/user/:userId', protect, authorize('admin'), deleteUser);

export default router;
