import express from 'express';
import {
    getProfile,
    updateProfile,
    getUserStats
} from '../controllers/userController';
import { protect } from '../middleware/auth';

const router = express.Router();

router.use(protect);

router.get('/profile', getProfile);
router.put('/profile', updateProfile);

router.get('/stats', getUserStats);

export default router;
