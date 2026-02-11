import express from 'express';
import { getAttendanceTrends, getBusyHours, getMemberStats } from '../controllers/reportController';
import { protect, authorize } from '../middleware/auth';

const router = express.Router();

router.use(protect);
router.use(authorize('admin', 'manager'));

router.get('/attendance-trends', getAttendanceTrends);
router.get('/busy-hours', getBusyHours);
router.get('/member-stats', getMemberStats);

export default router;
