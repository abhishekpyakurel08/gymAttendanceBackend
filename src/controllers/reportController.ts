import { Response } from 'express';
import Attendance from '../models/Attendance';
import User from '../models/User';
import { AuthRequest } from '../middleware/auth';
import moment from 'moment-timezone';
import mongoose from 'mongoose';

const TIMEZONE = 'Asia/Kathmandu';

/**
 * @desc    Get attendance trends (Visits per day over the last 30 days)
 * @route   GET /api/reports/attendance-trends
 * @access  Private (Admin)
 */
export const getAttendanceTrends = async (req: AuthRequest, res: Response) => {
    try {
        if (req.user.role !== 'admin' && req.user.role !== 'manager') {
            return res.status(403).json({ success: false, message: 'Not authorized' });
        }

        const thirtyDaysAgo = moment().tz(TIMEZONE).subtract(30, 'days').startOf('day').toDate();

        const trends = await Attendance.aggregate([
            {
                $match: {
                    date: { $gte: thirtyDaysAgo }
                }
            },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
                    count: { $sum: 1 }
                }
            },
            { $sort: { "_id": 1 } }
        ]);

        res.status(200).json({
            success: true,
            data: trends
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Get heat map of gym busy hours
 * @route   GET /api/reports/busy-hours
 * @access  Private (Admin)
 */
export const getBusyHours = async (req: AuthRequest, res: Response) => {
    try {
        const startOfMonth = moment().tz(TIMEZONE).startOf('month').toDate();

        const hourlyStats = await Attendance.aggregate([
            {
                $match: {
                    clockIn: { $ne: null },
                    date: { $gte: startOfMonth }
                }
            },
            {
                $project: {
                    hour: { $hour: { date: "$clockIn", timezone: TIMEZONE } }
                }
            },
            {
                $group: {
                    _id: "$hour",
                    visits: { $sum: 1 }
                }
            },
            { $sort: { "_id": 1 } }
        ]);

        res.status(200).json({
            success: true,
            data: hourlyStats
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Get member distribution by plan and status
 * @route   GET /api/reports/member-stats
 * @access  Private (Admin)
 */
export const getMemberStats = async (req: AuthRequest, res: Response) => {
    try {
        const planDistribution = await User.aggregate([
            { $match: { role: 'user' } },
            {
                $group: {
                    _id: "$membership.plan",
                    count: { $sum: 1 }
                }
            }
        ]);

        const statusDistribution = await User.aggregate([
            { $match: { role: 'user' } },
            {
                $group: {
                    _id: "$membership.status",
                    count: { $sum: 1 }
                }
            }
        ]);

        res.status(200).json({
            success: true,
            data: {
                plans: planDistribution,
                status: statusDistribution
            }
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};
