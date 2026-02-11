import express from 'express';
import { getTransactions, addTransaction, getDailyStats, getMonthlyStats } from '../controllers/financeController';
import { protect, authorize } from '../middleware/auth';

const router = express.Router();

// Admin Only Routes
router.use(protect);
router.use(authorize('admin', 'manager'));

router.get('/transactions', getTransactions);
router.get('/stats/daily', getDailyStats);
router.get('/stats/monthly', getMonthlyStats);
router.post('/transactions/add', addTransaction);

export default router;

