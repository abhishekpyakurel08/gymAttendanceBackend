import { Request, Response } from 'express';
import Transaction from '../models/Transaction';
import User from '../models/User';
import { AuthRequest } from '../middleware/auth';

// @desc    Get all transactions
// @route   GET /api/finance/transactions
// @access  Private (Admin only)
export const getTransactions = async (req: AuthRequest, res: Response) => {
    try {
        if (req.user.role !== 'admin' && req.user.role !== 'manager') {
            return res.status(403).json({ success: false, message: 'Not authorized' });
        }

        const transactions = await Transaction.find()
            .populate('userId', 'firstName lastName email')
            .sort({ date: -1 });

        const data = transactions.map((t: any) => ({
            _id: t._id,
            userId: t.userId?._id,
            userName: t.userId ? `${t.userId.firstName} ${t.userId.lastName}` : 'Unknown User',
            type: t.type,
            amount: t.amount,
            method: t.method,
            plan: t.plan,
            date: t.date,
            description: t.description
        }));

        res.status(200).json({
            success: true,
            data
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// @desc    Add a new transaction
// @route   POST /api/finance/transactions/add
// @access  Private (Admin only)
export const addTransaction = async (req: AuthRequest, res: Response) => {
    try {
        if (req.user.role !== 'admin' && req.user.role !== 'manager') {
            return res.status(403).json({ success: false, message: 'Not authorized' });
        }

        const { userId, type, amount, method, plan, description } = req.body;

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const transaction = await Transaction.create({
            userId,
            type,
            amount,
            method,
            plan,
            description,
            date: new Date()
        });

        res.status(201).json({
            success: true,
            data: transaction
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};
