import { Response } from 'express';
import User from '../models/User';
import Attendance from '../models/Attendance';
import Transaction from '../models/Transaction';
import { AuthRequest } from '../middleware/auth';
import moment from 'moment-timezone';
import logger from '../utils/logger';

const TIMEZONE = 'Asia/Kathmandu';

/**
 * @desc    Get all staff members
 * @route   GET /api/staff
 * @access  Private (Admin only)
 */
export const getAllStaff = async (req: AuthRequest, res: Response) => {
    try {
        if (req.user.role !== 'admin' && req.user.role !== 'manager') {
            return res.status(403).json({ success: false, message: 'Not authorized' });
        }

        const staff = await User.find({
            role: { $in: ['admin', 'manager'] },
            isActive: true
        }).select('-password');

        res.status(200).json({
            success: true,
            count: staff.length,
            data: staff
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Update staff profile (Salary, Shift, etc.)
 * @route   PUT /api/staff/:id
 * @access  Private (Admin only)
 */
export const updateStaffProfile = async (req: AuthRequest, res: Response) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Only super admins can update staff financials' });
        }

        const { salary, paymentFrequency, shift, role, department, isActive } = req.body;

        const staff = await User.findById(req.params.id);
        if (!staff) {
            return res.status(404).json({ success: false, message: 'Staff member not found' });
        }

        if (salary !== undefined) staff.salary = salary;
        if (paymentFrequency) staff.paymentFrequency = paymentFrequency;
        if (shift) staff.shift = shift;
        if (role) staff.role = role;
        if (department) staff.department = department;
        if (isActive !== undefined) staff.isActive = isActive;

        await staff.save();

        res.status(200).json({
            success: true,
            data: staff
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Record salary payment
 * @route   POST /api/staff/:id/pay
 * @access  Private (Admin only)
 */
export const payStaffSalary = async (req: AuthRequest, res: Response) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Not authorized' });
        }

        const { amount, method, description } = req.body;
        const staff = await User.findById(req.params.id);

        if (!staff) {
            return res.status(404).json({ success: false, message: 'Staff member not found' });
        }

        const transaction = await Transaction.create({
            userId: staff._id,
            category: 'expense',
            type: 'salary',
            amount: amount || staff.salary || 0,
            method: method || 'cash',
            description: description || `Salary payment for ${staff.firstName} ${staff.lastName}`,
            date: new Date()
        });

        res.status(201).json({
            success: true,
            message: 'Salary payment recorded',
            data: transaction
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Get staff attendance summary
 * @route   GET /api/staff/:id/attendance
 * @access  Private (Admin only)
 */
export const getStaffAttendance = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { month, year } = req.query;

        const startOfMonth = moment().tz(TIMEZONE);
        if (month) startOfMonth.month(Number(month) - 1);
        if (year) startOfMonth.year(Number(year));
        startOfMonth.startOf('month');

        const endOfMonth = startOfMonth.clone().endOf('month');

        const attendance = await Attendance.find({
            userId: id,
            date: { $gte: startOfMonth.toDate(), $lte: endOfMonth.toDate() }
        }).sort({ date: 1 });

        res.status(200).json({
            success: true,
            count: attendance.length,
            data: attendance
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};
