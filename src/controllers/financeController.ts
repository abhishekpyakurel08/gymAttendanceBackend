import { Response } from 'express';
import Transaction from '../models/Transaction';
import User from '../models/User';
import { AuthRequest } from '../middleware/auth';
import moment from 'moment-timezone';
import mongoose from 'mongoose';
import logger from '../utils/logger';

const TIMEZONE = 'Asia/Kathmandu';

/**
 * @desc    Get financial dashboard stats (Today)
 * @route   GET /api/finance/stats/daily
 * @access  Private (Admin only)
 */
export const getDailyStats = async (req: AuthRequest, res: Response) => {
    try {
        if (req.user.role !== 'admin' && req.user.role !== 'manager' && req.user.role !== 'reception') {
            return res.status(403).json({ success: false, message: 'Not authorized' });
        }

        const startOfDay = moment().tz(TIMEZONE).startOf('day').toDate();
        const endOfDay = moment().tz(TIMEZONE).endOf('day').toDate();

        const stats = await Transaction.aggregate([
            {
                $match: {
                    date: { $gte: startOfDay, $lte: endOfDay }
                }
            },
            {
                $group: {
                    _id: '$category',
                    total: { $sum: '$amount' }
                }
            }
        ]);

        const summary = {
            income: 0,
            expense: 0,
            net: 0
        };

        stats.forEach(s => {
            if (s._id === 'income') summary.income = s.total;
            if (s._id === 'expense') summary.expense = s.total;
        });

        summary.net = summary.income - summary.expense;

        res.status(200).json({
            success: true,
            data: summary
        });
    } catch (error: any) {
        logger.error(`Error in getDailyStats: ${error.message}`);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Get weekly financial stats for charts (Last 7 days)
 * @route   GET /api/finance/stats/weekly
 * @access  Private (Admin/Manager/Reception)
 */
export const getWeeklyStats = async (req: AuthRequest, res: Response) => {
    try {
        if (req.user.role !== 'admin' && req.user.role !== 'manager' && req.user.role !== 'reception') {
            return res.status(403).json({ success: false, message: 'Not authorized' });
        }

        const startOfSevenDaysAgo = moment().tz(TIMEZONE).subtract(6, 'days').startOf('day').toDate();
        const endOfToday = moment().tz(TIMEZONE).endOf('day').toDate();

        const weeklyStats = await Transaction.aggregate([
            {
                $match: {
                    date: { $gte: startOfSevenDaysAgo, $lte: endOfToday }
                }
            },
            {
                $group: {
                    _id: {
                        day: { $dayOfWeek: '$date' },
                        date: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
                        category: '$category'
                    },
                    amount: { $sum: '$amount' }
                }
            },
            { $sort: { '_id.date': 1 } }
        ]);

        // Days map for labels
        const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const chartData: any[] = [];

        // Initialize last 7 days including today
        for (let i = 6; i >= 0; i--) {
            const m = moment().tz(TIMEZONE).subtract(i, 'days');
            chartData.push({
                name: dayLabels[m.day()],
                date: m.format('YYYY-MM-DD'),
                income: 0,
                expense: 0
            });
        }

        weeklyStats.forEach(stat => {
            const dataPoint = chartData.find(d => d.date === stat._id.date);
            if (dataPoint) {
                if (stat._id.category === 'income') dataPoint.income = stat.amount;
                else dataPoint.expense = stat.amount;
            }
        });

        res.status(200).json({
            success: true,
            data: chartData
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Get monthly financial stats for charts
 * @route   GET /api/finance/stats/monthly
 * @access  Private (Admin only)
 */
export const getMonthlyStats = async (req: AuthRequest, res: Response) => {
    try {
        if (req.user.role !== 'admin' && req.user.role !== 'manager' && req.user.role !== 'reception') {
            return res.status(403).json({ success: false, message: 'Not authorized' });
        }

        const startOfMonth = moment().tz(TIMEZONE).startOf('month').toDate();
        const endOfMonth = moment().tz(TIMEZONE).endOf('month').toDate();

        // Daily breakdown for the current month
        const dailyStats = await Transaction.aggregate([
            {
                $match: {
                    date: { $gte: startOfMonth, $lte: endOfMonth }
                }
            },
            {
                $group: {
                    _id: {
                        day: { $dayOfMonth: '$date' },
                        category: '$category'
                    },
                    amount: { $sum: '$amount' }
                }
            },
            { $sort: { '_id.day': 1 } }
        ]);

        // Process for frontend charts (e.g. [ { day: 1, income: 100, expense: 50 }, ... ])
        const chartData: any[] = [];
        const daysInMonth = moment().daysInMonth();

        for (let i = 1; i <= daysInMonth; i++) {
            chartData.push({ day: i, income: 0, expense: 0 });
        }

        dailyStats.forEach(stat => {
            const index = stat._id.day - 1;
            if (chartData[index]) {
                if (stat._id.category === 'income') chartData[index].income = stat.amount;
                else chartData[index].expense = stat.amount;
            }
        });

        res.status(200).json({
            success: true,
            data: chartData
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Get all transactions with filtering
 * @route   GET /api/finance/transactions
 * @access  Private (Admin only)
 */
export const getTransactions = async (req: AuthRequest, res: Response) => {
    try {
        if (req.user.role !== 'admin' && req.user.role !== 'manager' && req.user.role !== 'reception') {
            return res.status(403).json({ success: false, message: 'Not authorized' });
        }

        const { userId, category, type, startDate, endDate } = req.query;
        const query: any = {};

        if (userId) query.userId = userId;
        if (category) query.category = category;
        if (type) query.type = type;
        if (startDate || endDate) {
            query.date = {};
            if (startDate) query.date.$gte = new Date(startDate as string);
            if (endDate) query.date.$lte = new Date(endDate as string);
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
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Add a new transaction (Income/Expense)
 * @route   POST /api/finance/transactions/add
 * @access  Private (Admin only)
 */
export const addTransaction = async (req: AuthRequest, res: Response) => {
    try {
        if (req.user.role !== 'admin' && req.user.role !== 'manager' && req.user.role !== 'reception') {
            return res.status(403).json({ success: false, message: 'Not authorized' });
        }

        const { userId, category, type, amount, method, plan, description, date } = req.body;

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
            date: date ? new Date(date) : new Date()
        });

        // 🔄 AUTOMATIC MEMBERSHIP UPDATE LOGIC (FOR INCOME)
        if (userId && (type === 'subscription' || type === 'registration') && category === 'income') {
            const user = await User.findById(userId);
            if (user) {
                const now = moment().tz(TIMEZONE);

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
                if (type === 'registration' && (!user.membership || user.membership.plan === 'none')) {
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

        // 💰 BROADCAST TO DASHBOARDS
        const notificationService = require('../utils/notificationService').default;
        notificationService.sendAdminNotification('transaction_added', {
            transactionId: transaction._id,
            category: transaction.category,
            amount: transaction.amount,
            type: transaction.type
        });
        notificationService.sendAdminNotification('stats_updated', { type: 'finance' });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

