import { Response } from 'express';
import User from '../models/User';
import Attendance from '../models/Attendance';
import Transaction from '../models/Transaction';
import { AuthRequest } from '../middleware/auth';
import moment from 'moment-timezone';

const TIMEZONE = 'Asia/Kathmandu';

/**
 * @desc    Get main dashboard summary for Admin/Manager
 * @route   GET /api/dashboard/summary
 * @access  Private (Admin)
 */
export const getDashboardSummary = async (req: AuthRequest, res: Response) => {
    try {
        if (req.user.role !== 'admin' && req.user.role !== 'manager' && req.user.role !== 'reception') {
            return res.status(403).json({ success: false, message: 'Not authorized' });
        }

        const now = moment().tz(TIMEZONE);
        const startOfDay = now.clone().startOf('day').toDate();
        const endOfDay = now.clone().endOf('day').toDate();
        const startOfMonth = now.clone().startOf('month').toDate();

        // 1. Attendance Stats
        const presentToday = await Attendance.countDocuments({
            date: { $gte: startOfDay, $lte: endOfDay }
        });

        // 2. Member Stats
        const totalMembers = await User.countDocuments({ role: 'user', isActive: true });
        const newMembersToday = await User.countDocuments({
            role: 'user',
            createdAt: { $gte: startOfDay, $lte: endOfDay }
        });

        // 3. Financial Stats (Income Breakdown)
        const revenueByMethodToday = await Transaction.aggregate([
            {
                $match: {
                    category: 'income',
                    date: { $gte: startOfDay, $lte: endOfDay }
                }
            },
            { $group: { _id: '$method', total: { $sum: '$amount' } } }
        ]);

        const totalRevenueToday = revenueByMethodToday.reduce((acc, curr) => acc + curr.total, 0);
        const cashToday = revenueByMethodToday
            .filter(r => r._id?.toLowerCase() === 'cash')
            .reduce((acc, curr) => acc + curr.total, 0);
        const onlineToday = totalRevenueToday - cashToday;


        const revenueThisMonth = await Transaction.aggregate([
            {
                $match: {
                    category: 'income',
                    date: { $gte: startOfMonth }
                }
            },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);

        // 3a. Financial Stats (Expense)
        const expenseToday = await Transaction.aggregate([
            {
                $match: {
                    category: 'expense',
                    date: { $gte: startOfDay, $lte: endOfDay }
                }
            },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);

        const expenseThisMonth = await Transaction.aggregate([
            {
                $match: {
                    category: 'expense',
                    date: { $gte: startOfMonth }
                }
            },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);

        // 4. Upcoming Expirations (Next 7 days)
        const sevenDaysFromNow = now.clone().add(7, 'days').toDate();
        const upcomingExpirations = await User.countDocuments({
            role: 'user',
            'membership.expiryDate': { $gte: endOfDay, $lte: sevenDaysFromNow },
            'membership.status': 'active'
        });

        // 5. Pending Membership Approvals
        const pendingApprovals = await User.countDocuments({
            'membership.status': 'pending'
        });

        // 6. Projected Revenue (Next 30 days)
        const thirtyDaysFromNow = now.clone().add(30, 'days').toDate();
        const expiringSoonMembers = await User.find({
            role: 'user',
            'membership.expiryDate': { $gte: endOfDay, $lte: thirtyDaysFromNow },
            'membership.status': 'active'
        });

        const planPrices: Record<string, number> = {
            '1-month': 2500,
            '3-month': 6500,
            '6-month': 12000,
            '1-year': 20000,
            'none': 0
        };

        const projectedRevenue = expiringSoonMembers.reduce((acc, user) => {
            const plan = user.membership?.plan || 'none';
            return acc + (planPrices[plan] || 0);
        }, 0);

        // 7. Top Spenders (Top 5 users by total income)
        const topSpendersResult = await Transaction.aggregate([
            { $match: { category: 'income', userId: { $ne: null } } },
            { $group: { _id: '$userId', totalSpent: { $sum: '$amount' } } },
            { $sort: { totalSpent: -1 } },
            { $limit: 5 },
            {
                $lookup: {
                    from: 'users',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'userInfo'
                }
            },
            { $unwind: '$userInfo' },
            {
                $project: {
                    _id: 1,
                    totalSpent: 1,
                    name: { $concat: ['$userInfo.firstName', ' ', '$userInfo.lastName'] },
                    plan: '$userInfo.membership.plan'
                }
            }
        ]);

        // 8. Churn Risk (Active members with no attendance in 14 days)
        const fourteenDaysAgo = now.clone().subtract(14, 'days').toDate();

        // Find all active users
        const activeUsers = await User.find({ role: 'user', isActive: true, 'membership.status': 'active' }, '_id firstName lastName membership');

        // Find users who HAS attendance within 14 days
        const steadyUsers = await Attendance.distinct('userId', {
            date: { $gte: fourteenDaysAgo }
        });

        // Churn risks are those in activeUsers NOT in steadyUsers
        const churnRiskMembers = activeUsers.filter(u => !steadyUsers.some(id => id.toString() === u._id.toString())).slice(0, 5);

        // 9. Financial Category Breakdowns (This Month)
        const incomeBreakdown = await Transaction.aggregate([
            {
                $match: {
                    category: 'income',
                    date: { $gte: startOfMonth }
                }
            },
            { $group: { _id: '$type', total: { $sum: '$amount' } } }
        ]);

        const expenseBreakdown = await Transaction.aggregate([
            {
                $match: {
                    category: 'expense',
                    date: { $gte: startOfMonth }
                }
            },
            { $group: { _id: '$type', total: { $sum: '$amount' } } }
        ]);

        const monthlyRevenue = revenueThisMonth[0]?.total || 0;
        const monthlyExpense = expenseThisMonth[0]?.total || 0;

        res.status(200).json({
            success: true,
            data: {
                attendance: {
                    presentToday,
                    activeTotal: totalMembers
                },
                members: {
                    newToday: newMembersToday,
                    total: totalMembers,
                    pendingApprovals,
                    upcomingExpirations,
                    upcomingRenewals30d: expiringSoonMembers.length,
                    churnRisk: churnRiskMembers.map(u => ({
                        _id: u._id,
                        name: `${u.firstName} ${u.lastName}`,
                        plan: u.membership?.plan
                    }))
                },
                financials: {
                    revenueToday: totalRevenueToday,
                    cashToday,
                    onlineToday,
                    revenueThisMonth: monthlyRevenue,

                    expenseToday: expenseToday[0]?.total || 0,
                    expenseThisMonth: monthlyExpense,
                    netMonth: monthlyRevenue - monthlyExpense,
                    projectedRevenue30d: projectedRevenue,
                    topSpenders: topSpendersResult,
                    incomeBreakdown,
                    expenseBreakdown
                }
            }
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};
