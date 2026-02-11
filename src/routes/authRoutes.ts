import express from 'express';
import { register, login, adminLogin, createAdmin, getMe, updateProfile, updateMembership, getMembershipStatus, approveMembership, getAllUsers, updateUser, deleteUser } from '../controllers/authController';
import { protect, authorize } from '../middleware/auth';

const router = express.Router();

router.post('/register', protect, register);
router.post('/login', login);
router.post('/admin/login', adminLogin);
router.post('/admin/create', protect, authorize('admin'), createAdmin);
router.get('/me', protect, getMe);
router.put('/me', protect, updateProfile);

// Membership routes
router.put('/membership', protect, updateMembership);
router.get('/membership/status', protect, getMembershipStatus);
router.put('/update-push-token', protect, (req: any, res) => {
    // Simple inline controller for push token
    require('../models/User').default.findByIdAndUpdate(req.user.id, { pushToken: req.body.pushToken })
        .then(() => res.json({ success: true }))
        .catch((err: any) => res.status(500).json({ success: false, error: err.message }));
});

// Admin routes
router.put('/membership/approve/:userId', protect, approveMembership);
router.get('/users', protect, getAllUsers);
router.put('/users/:id', protect, updateUser);
router.delete('/users/:id', protect, deleteUser);

export default router;
