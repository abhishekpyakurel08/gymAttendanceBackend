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

// Image upload disabled as per user request (Stick to Dicebear)
// router.post('/profile/image', upload.single('image'), uploadProfileImage);

router.get('/stats', getUserStats);

export default router;
