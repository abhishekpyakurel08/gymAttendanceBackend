import express from 'express';
import { getGymSettings, updateGymSettings, getGymStatus } from '../controllers/gymSettingsController';
import { protect, authorize } from '../middleware/auth';

const router = express.Router();

// Public routes
router.get('/', getGymSettings);
router.get('/status', getGymStatus);

// Admin/Manager only routes
router.put('/', protect, authorize('admin', 'manager'), updateGymSettings);

export default router;
