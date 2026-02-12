import express from 'express';
import { getTransactions, addTransaction, getDailyStats, getMonthlyStats, getWeeklyStats } from '../controllers/financeController';
import { protect, authorize } from '../middleware/auth';

const router = express.Router();

// Finance Access for Admin, Manager, and Reception
router.use(protect);
router.use(authorize('admin', 'manager', 'reception'));

router.get('/transactions', getTransactions);
router.get('/stats/daily', getDailyStats);
router.get('/stats/weekly', getWeeklyStats);
router.get('/stats/monthly', getMonthlyStats);
router.post('/transactions/add', addTransaction);

export default router;

