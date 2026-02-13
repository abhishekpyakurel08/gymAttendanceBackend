import { Request, Response } from 'express';
import User from '../models/User';
import moment from 'moment-timezone';

// Create membership
export const createMembership = async (req: Request, res: Response) => {
    try {
        const { plan, startDate, expiryDate } = req.body;
        const user = await User.findById(req.params.userId);
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });
        user.membership = {
            plan,
            startDate: startDate ? new Date(startDate) : new Date(),
            expiryDate: expiryDate ? new Date(expiryDate) : moment().add(1, 'month').toDate(),
            status: 'active',
            monthlyDayCount: 0,
            lastResetDate: new Date()
        };
        await user.save();
        res.status(200).json({ success: true, message: 'Membership created', membership: user.membership });

        // 🔄 BROADCAST
        const notificationService = require('../utils/notificationService').default;
        notificationService.sendAdminNotification('membership_approved', { userId: user._id, status: 'active' });
        notificationService.sendAdminNotification('stats_updated', { type: 'membership' });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Update membership
export const updateMembership = async (req: Request, res: Response) => {
    try {
        const { plan, expiryDate, status } = req.body;
        const user = await User.findById(req.params.userId);
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });
        if (!user.membership) {
            user.membership = {
                plan: plan || 'none',
                startDate: new Date(),
                expiryDate: expiryDate ? new Date(expiryDate) : new Date(),
                status: status || 'active',
                monthlyDayCount: 0,
                lastResetDate: new Date()
            };
        } else {
            if (plan) user.membership.plan = plan;
            if (expiryDate) user.membership.expiryDate = new Date(expiryDate);
            if (status) user.membership.status = status;
        }
        await user.save();
        res.status(200).json({ success: true, message: 'Membership updated', membership: user.membership });

        // 🔄 BROADCAST
        const notificationService = require('../utils/notificationService').default;
        notificationService.sendAdminNotification('membership_approved', { userId: user._id, status: user.membership.status });
        notificationService.sendAdminNotification('stats_updated', { type: 'membership' });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Expire membership
export const expireMembership = async (req: Request, res: Response) => {
    try {
        const user = await User.findById(req.params.userId);
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });
        if (!user.membership) {
            user.membership = {
                plan: 'none',
                startDate: new Date(),
                expiryDate: new Date(),
                status: 'expired',
                monthlyDayCount: 0,
                lastResetDate: new Date()
            };
        } else {
            user.membership.status = 'expired';
            user.membership.expiryDate = new Date();
        }
        await user.save();
        res.status(200).json({ success: true, message: 'Membership expired', membership: user.membership });

        // 🔄 BROADCAST
        const notificationService = require('../utils/notificationService').default;
        notificationService.sendAdminNotification('membership_approved', { userId: user._id, status: 'expired' });
        notificationService.sendAdminNotification('stats_updated', { type: 'membership' });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Update User (Admin Only)
export const updateUser = async (req: Request, res: Response) => {
    try {
        const { firstName, lastName, email, phoneNumber, department, shift, role } = req.body;
        const user = await User.findById(req.params.userId);
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        if (firstName) user.firstName = firstName;
        if (lastName) user.lastName = lastName;
        if (email) user.email = email;
        if (phoneNumber) user.phoneNumber = phoneNumber;
        if (department) user.department = department;
        if (shift) user.shift = shift;
        if (role) user.role = role;

        await user.save();
        res.status(200).json({ success: true, data: user });

        // 🔄 BROADCAST
        const notificationService = require('../utils/notificationService').default;
        notificationService.sendAdminNotification('stats_updated', { type: 'user' });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Toggle User Active Status
export const toggleUserStatus = async (req: Request, res: Response) => {
    try {
        const user = await User.findById(req.params.userId);
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        user.isActive = !user.isActive;
        await user.save();

        res.status(200).json({
            success: true,
            message: `User ${user.isActive ? 'activated' : 'deactivated'} successfully`,
            data: { isActive: user.isActive }
        });

        // 🔄 BROADCAST
        const notificationService = require('../utils/notificationService').default;
        notificationService.sendAdminNotification('stats_updated', { type: 'user' });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Delete User and all associated data
export const deleteUser = async (req: Request, res: Response) => {
    try {
        const user = await User.findById(req.params.userId);
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        // Delete associated records if necessary (e.g. Attendance)
        const Attendance = require('../models/Attendance').default;
        await Attendance.deleteMany({ userId: user._id });

        await User.findByIdAndDelete(req.params.userId);

        res.status(200).json({ success: true, message: 'User and all associated records deleted permanently' });

        // 🔄 BROADCAST
        const notificationService = require('../utils/notificationService').default;
        notificationService.sendAdminNotification('stats_updated', { type: 'user' });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};
/**
 * @desc    Export members to CSV
 * @route   GET /api/admin/export-members
 * @access  Private (Admin/Manager)
 */
export const exportMembers = async (req: any, res: Response) => {
    try {
        const members = await User.find({ role: 'user' }).sort({ createdAt: -1 });

        // Generate CSV content
        let csv = 'Employee ID,Name,Email,Phone,Plan,Status,Expiry Date,Joined Date\n';

        members.forEach((m: any) => {
            const name = `${m.firstName} ${m.lastName}`;
            const plan = m.membership?.plan || 'N/A';
            const status = m.membership?.status || 'N/A';
            const expiry = m.membership?.expiryDate ? moment(m.membership.expiryDate).format('YYYY-MM-DD') : 'N/A';
            const joined = moment(m.createdAt).format('YYYY-MM-DD');

            csv += `${m.employeeId},${name},${m.email},${m.phoneNumber || ''},${plan},${status},${expiry},${joined}\n`;
        });

        const filename = `members_report_${moment().format('YYYY-MM-DD')}.csv`;

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
        res.status(200).send(csv);

    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};
