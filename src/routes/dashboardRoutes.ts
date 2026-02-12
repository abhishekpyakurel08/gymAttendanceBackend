import express from 'express';
import { getDashboardSummary } from '../controllers/dashboardController';
import { protect, authorize } from '../middleware/auth';

const router = express.Router();

router.get('/summary', protect, authorize('admin', 'manager', 'reception'), getDashboardSummary);

export default router;
