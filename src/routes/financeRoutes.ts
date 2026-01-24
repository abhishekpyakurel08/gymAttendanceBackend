import express from 'express';
import { getTransactions, addTransaction } from '../controllers/financeController';
import { protect } from '../middleware/auth';

const router = express.Router();

router.get('/transactions', protect, getTransactions);
router.post('/transactions/add', protect, addTransaction);

export default router;
