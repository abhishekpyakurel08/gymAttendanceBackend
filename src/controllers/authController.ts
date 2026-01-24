import { Request, Response } from 'express';
import User from '../models/User';
import generateToken from '../utils/generateToken';
import { AuthRequest } from '../middleware/auth';
import moment from 'moment-timezone';
import notificationService from '../utils/notificationService';

// @desc    Register new user
// @route   POST /api/auth/register
// @access  Public
export const register = async (req: Request, res: Response) => {
    try {
        const { employeeId, email, password, firstName, lastName, department, role } = req.body;

        // Check if user exists
        const userExists = await User.findOne({ $or: [{ email }, { employeeId }] });

        if (userExists) {
            return res.status(400).json({
                success: false,
                message: 'User with this email or employee ID already exists'
            });
        }

        // Create user
        const user = await User.create({
            employeeId,
            email,
            password,
            firstName,
            lastName,
            department,
            role: role || 'user'
        });

        // Generate token (1 year expiration)
        const token = generateToken({
            id: user._id.toString(),
            email: user.email,
            role: user.role
        });

        res.status(201).json({
            success: true,
            data: {
                user: {
                    id: user._id,
                    employeeId: user.employeeId,
                    email: user.email,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    department: user.department,
                    role: user.role,
                    membership: user.membership
                },
                token
            }
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
export const login = async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Please provide email and password'
            });
        }

        // Find user
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        // Check if user is active
        if (!user.isActive) {
            return res.status(401).json({
                success: false,
                message: 'Your account has been deactivated'
            });
        }

        // Check password
        const isPasswordMatch = await user.comparePassword(password);

        if (!isPasswordMatch) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        // Generate token (1 year expiration)
        const token = generateToken({
            id: user._id.toString(),
            email: user.email,
            role: user.role
        });

        res.status(200).json({
            success: true,
            data: {
                user: {
                    id: user._id,
                    employeeId: user.employeeId,
                    email: user.email,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    department: user.department,
                    role: user.role,
                    membership: user.membership
                },
                token
            }
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
export const getMe = async (req: AuthRequest, res: Response) => {
    try {
        const user = await User.findById(req.user.id).select('-password');

        res.status(200).json({
            success: true,
            data: user
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// @desc    Update or Start User Membership
// @route   PUT /api/auth/membership
// @access  Private (Self or Admin)
export const updateMembership = async (req: AuthRequest, res: Response) => {
    try {
        const { plan, startDate } = req.body;
        const validPlans = ['1-month', '3-month', '6-month', '1-year'];

        if (!validPlans.includes(plan)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid membership plan'
            });
        }

        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // Logic for Renewal vs New Subscription
        let start = startDate ? moment(startDate) : moment();
        let isRenewal = false;

        // If user has an active membership, start the new one after the current expires
        if (user.membership && user.membership.status === 'active' && moment(user.membership.expiryDate).isAfter(moment())) {
            start = moment(user.membership.expiryDate);
            isRenewal = true;
        }

        let expiry = moment(start);
        switch (plan) {
            case '1-month': expiry = expiry.add(1, 'month'); break;
            case '3-month': expiry = expiry.add(3, 'months'); break;
            case '6-month': expiry = expiry.add(6, 'months'); break;
            case '1-year': expiry = expiry.add(1, 'year'); break;
        }

        user.membership = {
            plan,
            startDate: start.toDate(),
            expiryDate: expiry.toDate(),
            status: 'pending', // Requires Admin/Manager Approval
            monthlyDayCount: user.membership?.monthlyDayCount || 0,
            lastResetDate: user.membership?.lastResetDate || moment().toDate()
        };

        await user.save();

        // Notify Admins/Managers
        try {
            const admins = await User.find({ role: { $in: ['admin', 'manager'] } });
            for (const admin of admins) {
                await notificationService.sendNotification({
                    recipientId: admin._id.toString(),
                    type: 'system',
                    title: 'New Membership Request 📝',
                    message: `${user.firstName} ${user.lastName} requested a ${plan.replace('-', ' ')} plan.`,
                    data: { userId: user._id, type: 'membership_request' }
                });
            }
        } catch (notifyError) {
            console.error('Failed to notify admins:', notifyError);
        }

        res.status(200).json({
            success: true,
            message: isRenewal
                ? 'Renewal request sent for approval. Your new plan will start after your current one expires.'
                : 'Membership request sent to admin/manager for approval',
            data: user.membership,
            isRenewal
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// @desc    Approve Membership (Admin Only)
// @route   PUT /api/auth/membership/approve/:userId
// @access  Private (Admin)
export const approveMembership = async (req: AuthRequest, res: Response) => {
    try {
        if (req.user.role !== 'admin' && req.user.role !== 'manager') {
            return res.status(403).json({ success: false, message: 'Not authorized' });
        }

        const user = await User.findById(req.params.userId);
        if (!user || !user.membership) {
            return res.status(404).json({ success: false, message: 'User or membership request not found' });
        }

        user.membership.status = 'active';
        await user.save();

        // Trigger Notification
        await notificationService.sendNotification({
            recipientId: user._id.toString(),
            type: 'membership_approved',
            title: 'Membership Activated! 🎊',
            message: `Your ${user.membership.plan.replace('-', ' ')} plan has been approved. Welcome to the gym!`,
            senderId: req.user.id
        });

        res.status(200).json({
            success: true,
            message: 'Membership approved',
            data: user.membership
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get All Users with Membership Details (Admin Only)
// @route   GET /api/auth/users
// @access  Private (Admin)
export const getAllUsers = async (req: AuthRequest, res: Response) => {
    try {
        if (req.user.role !== 'admin' && req.user.role !== 'manager') {
            return res.status(403).json({ success: false, message: 'Not authorized' });
        }

        const users = await User.find().select('-password');
        res.status(200).json({
            success: true,
            data: users
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get Membership Status
// @route   GET /api/auth/membership/status
// @access  Private
export const getMembershipStatus = async (req: AuthRequest, res: Response) => {
    try {
        const user = await User.findById(req.user.id).select('membership');

        if (!user || !user.membership) {
            return res.status(200).json({
                success: true,
                data: { plan: 'none', status: 'pending' }
            });
        }

        res.status(200).json({
            success: true,
            data: user.membership
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};
