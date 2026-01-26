import { Request, Response } from 'express';
import Transaction from '../models/Transaction';
import User from '../models/User';
import { AuthRequest } from '../middleware/auth';
import moment from 'moment-timezone';
import mongoose from 'mongoose';

const TIMEZONE = 'Asia/Kathmandu';

export const getDailyStats = async (req: AuthRequest, res: Response) => {
    try {
        if (req.user.role !== 'admin' && req.user.role !== 'manager') {
            return res.status(403).json({ success: false, message: 'Not authorized' });
        }

        const startOfDay = moment().tz(TIMEZONE).startOf('day').toDate();
        const endOfDay = moment().tz(TIMEZONE).endOf('day').toDate();

        const stats = await Transaction.aggregate([
            {
                $match: {
                    date: { $gte: startOfDay, $lte: endOfDay },
                    category: 'income'
                }
            },
            {
                $group: {
                    _id: null,
                    totalRevenue: { $sum: '$amount' }
                }
            }
        ]);

        res.status(200).json({
            success: true,
            data: {
                revenue: stats[0]?.totalRevenue || 0
            }
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get all transactions
// @route   GET /api/finance/transactions
// @access  Private (Admin only)
export const getTransactions = async (req: AuthRequest, res: Response) => {
    try {
        if (req.user.role !== 'admin' && req.user.role !== 'manager') {
            return res.status(403).json({ success: false, message: 'Not authorized' });
        }

        const { userId } = req.query;
        const query: any = {};

        if (userId) {
            query.userId = userId;
        }

        const transactions = await Transaction.find(query)
            .populate('userId', 'firstName lastName email')
            .sort({ date: -1 });

        const data = transactions.map((t: any) => ({
            _id: t._id,
            userId: t.userId?._id,
            userName: t.userId ? `${t.userId.firstName} ${t.userId.lastName}` : 'General',
            category: t.category,
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

        const { userId, category, type, amount, method, plan, description } = req.body;

        if (userId) {
            const user = await User.findById(userId);
            if (!user) {
                return res.status(404).json({ success: false, message: 'User not found' });
            }
        }

        const transaction = await Transaction.create({
            userId: userId || null,
            category: category || 'income',
            type,
            amount,
            method,
            plan,
            description,
            date: new Date()
        });

        // 🔄 AUTOMATIC MEMBERSHIP UPDATE LOGIC
        if (userId && (type === 'subscription' || type === 'registration') && category === 'income') {
            const user = await User.findById(userId);
            if (user) {
                const now = moment();

                // If confirming a subscription payment
                if (type === 'subscription' && plan) {
                    let start = now.clone();
                    // If already active, extend from current expiry
                    if (user.membership?.status === 'active' && user.membership.expiryDate) {
                        const currentExpiry = moment(user.membership.expiryDate);
                        if (currentExpiry.isAfter(now)) {
                            start = currentExpiry;
                        }
                    }

                    let expiry = start.clone();
                    switch (plan) {
                        case '1-month': expiry.add(1, 'month'); break;
                        case '3-month': expiry.add(3, 'months'); break;
                        case '6-month': expiry.add(6, 'months'); break;
                        case '1-year': expiry.add(1, 'year'); break;
                        default: expiry.add(1, 'month');
                    }

                    user.membership = {
                        plan: plan,
                        startDate: start.toDate() as any,
                        expiryDate: expiry.toDate() as any,
                        status: 'active', // Auto-activate on payment
                        monthlyDayCount: user.membership?.monthlyDayCount || 0,
                        lastResetDate: user.membership?.lastResetDate || now.toDate() as any
                    };

                    await user.save();
                }

                // If admission fee (registration), ensure status is at least pending/active or initialized
                if (type === 'registration' && (!user.membership || !user.membership.status)) {
                    user.membership = {
                        plan: 'none',
                        startDate: now.toDate() as any,
                        expiryDate: now.toDate() as any,
                        status: 'pending',
                        monthlyDayCount: 0,
                        lastResetDate: now.toDate() as any
                    };
                    await user.save();
                }
            }
        }

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
