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
        if (req.user.role !== 'admin' && req.user.role !== 'manager') {
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

        // 3. Financial Stats
        const revenueToday = await Transaction.aggregate([
            {
                $match: {
                    category: 'income',
                    date: { $gte: startOfDay, $lte: endOfDay }
                }
            },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);

        const revenueThisMonth = await Transaction.aggregate([
            {
                $match: {
                    category: 'income',
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
                    upcomingExpirations
                },
                financials: {
                    revenueToday: revenueToday[0]?.total || 0,
                    revenueThisMonth: revenueThisMonth[0]?.total || 0
                }
            }
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};
