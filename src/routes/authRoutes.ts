import express from 'express';
import { register, login, getMe, updateMembership, getMembershipStatus, approveMembership, getAllUsers } from '../controllers/authController';
import { protect } from '../middleware/auth';

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.get('/me', protect, getMe);

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

export default router;
