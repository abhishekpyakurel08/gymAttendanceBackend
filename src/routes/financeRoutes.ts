import express from 'express';
import { getTransactions, addTransaction, getDailyStats } from '../controllers/financeController';
import { protect } from '../middleware/auth';

const router = express.Router();

router.get('/transactions', protect, getTransactions);
router.get('/transactions/daily-stats', protect, getDailyStats);
router.post('/transactions/add', protect, addTransaction);

export default router;
