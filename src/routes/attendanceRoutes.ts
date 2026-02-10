import express from 'express';
import {
    clockIn,
    clockOut,
    getMyHistory,
    getTodayStatus,
    getStats,
    getTodayAttendanceAll,
    getMemberHistory
} from '../controllers/attendanceController';
import { protect } from '../middleware/auth';

const router = express.Router();

router.post('/clock-in', protect, clockIn);
router.put('/clock-out', protect, clockOut);
router.get('/my-history', protect, getMyHistory);
router.get('/today', protect, getTodayStatus);
router.get('/stats', protect, getStats);

// Admin routes
router.get('/admin/today', protect, getTodayAttendanceAll);
router.get('/admin/absent', protect, getAbsentMembersToday);
router.get('/admin/history/:userId', protect, getMemberHistory);

export default router;
