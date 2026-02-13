import { Request, Response } from 'express';
import User from '../models/User';
import generateToken from '../utils/generateToken';
import { AuthRequest } from '../middleware/auth';
import moment from 'moment-timezone';
import notificationService from '../utils/notificationService';

// @desc    Register new user
// @route   POST /api/auth/register
// @access  Private (Admin/Manager)
export const register = async (req: Request, res: Response) => {
    try {
        const { employeeId, email, phoneNumber, password, firstName, lastName, department, role, age, gender, shift, requestedPlan, admissionFee, monthlyFee, paymentMethod } = req.body;


        const userExists = await User.findOne({ $or: [{ email }, { employeeId }] });

        if (userExists) {
            return res.status(400).json({
                success: false,
                message: 'User with this email or employee ID already exists'
            });
        }

        const profileImage = `https://api.dicebear.com/9.x/avataaars/png?seed=${email}`;

        // Initial Membership Setup
        let membership = undefined;
        if (requestedPlan && requestedPlan !== 'none') {
            const now = moment().tz('Asia/Kathmandu'); // Or default timezone
            let expiry = now.clone();

            if (requestedPlan === 'admission') {
                // Admission only - active but no subscription end date really? 
                // typically admission implies they can enter? Or just registration fee?
                // Let's set it to 'none' but status 'active' implies they are a member.
                // Or maybe give them 1 month trial? 
                // Let's assume Admission = 1 Month for now or just active 'none' plan which might fail checks?
                // Step 767 check: if plan === 'none' -> 'Active gym membership required'.
                // So 'admission' alone is not enough to enter.
                // If user selects 'Admission Only', maybe they pay fee but buy subscription later?
                // Let's map 'admission' to 'none' plan, status 'active'. They will be blocked from clock-in until they buy subscription. 
                // That is correct behavior.
                membership = {
                    plan: 'none',
                    startDate: now.toDate(),
                    expiryDate: now.toDate(),
                    status: 'active',
                    monthlyDayCount: 0,
                    lastResetDate: now.toDate()
                };
            } else {
                // Subscription plans
                switch (requestedPlan) {
                    case '1-month': expiry.add(1, 'month'); break;
                    case '3-month': expiry.add(3, 'months'); break;
                    case '6-month': expiry.add(6, 'months'); break;
                    case '1-year': expiry.add(1, 'year'); break;
                }
                membership = {
                    plan: requestedPlan,
                    startDate: now.toDate(),
                    expiryDate: expiry.toDate(),
                    status: 'active',
                    monthlyDayCount: 0,
                    lastResetDate: now.toDate()
                };
            }
        }

        const user = await User.create({
            employeeId,
            email,
            phoneNumber,
            password,
            firstName,
            lastName,
            department,
            role: role || 'user',
            age,
            gender,
            shift: shift || 'both',
            profileImage,
            membership
        });

        // 💰 AUTOMATED TRANSACTION RECORDING (SPLIT)
        const Transaction = require('../models/Transaction').default;

        // 1. Record Admission Fee
        if (admissionFee > 0) {
            await Transaction.create({
                userId: user._id,
                category: 'income',
                type: 'registration',
                amount: admissionFee,
                method: paymentMethod || 'cash',
                description: `Admission Fee for ${user.firstName} ${user.lastName}`,
                date: new Date()
            });
        }

        // 2. Record Package/Monthly Fee
        if (monthlyFee > 0) {
            await Transaction.create({
                userId: user._id,
                category: 'income',
                type: 'subscription',
                amount: monthlyFee,
                method: paymentMethod || 'cash',
                plan: requestedPlan !== 'admission' ? requestedPlan : undefined,
                description: `Subscription payment (${requestedPlan}) for ${user.firstName} ${user.lastName}`,
                date: new Date()
            });
        }


        const token = generateToken({
            id: user._id.toString(),
            email: user.email,
            role: user.role
        });

        // 🔔 REAL-TIME NOTIFICATION TO ADMINS
        try {
            const admins = await User.find({ role: { $in: ['admin', 'manager'] } });
            for (const admin of admins) {
                // Don't notify self if self is the creator? 
                // Creating user doesn't carry creator ID in body easily here (req.user might be available if I change signature to AuthRequest).
                // But register is public? No, access is Private (Admin/Manager).
                // So req should be AuthRequest really. But the signature is `req: Request`. 
                // Let's just notify all, it's fine. Frontend will just refresh.
                await notificationService.sendNotification({
                    recipientId: admin._id.toString(),
                    type: 'new_member',
                    title: 'New Member Joined! 🚀',
                    message: `${user.firstName} ${user.lastName} has been registered.${requestedPlan ? ` Plan: ${requestedPlan}` : ''}`,
                    data: { userId: user._id, type: 'new_member' }
                });
            }
        } catch (notifyError) {
            console.error('Failed to notify admins of new member:', notifyError);
        }

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
                    age: user.age,
                    gender: user.gender,
                    shift: user.shift,
                    profileImage: user.profileImage,
                    membership: user.membership
                },
                token
            }
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
export const login = async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'Please provide email and password' });
        }

        const user = await User.findOne({ email });

        if (!user) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        if (!user.isActive) {
            return res.status(401).json({ success: false, message: 'Your account has been deactivated' });
        }

        const isPasswordMatch = await user.comparePassword(password);

        if (!isPasswordMatch) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        // Gym-pass validity check
        if (!user.membership || user.membership.plan === 'none') {
            return res.status(401).json({ success: false, message: 'No active gym-pass. Please purchase a membership.' });
        }
        const now = new Date();
        if (user.membership.expiryDate && user.membership.expiryDate < now) {
            return res.status(401).json({ success: false, message: 'Your gym-pass has expired. Please renew your membership.' });
        }
        if (user.membership.status === 'expired') {
            return res.status(401).json({ success: false, message: 'Your gym-pass is expired. Please renew your membership.' });
        }

        if (!user.profileImage) {
            user.profileImage = `https://api.dicebear.com/9.x/avataaars/png?seed=${user.email}`;
            await user.save();
        }

        const token = generateToken({
            id: user._id.toString(),
            email: user.email,
            role: user.role
        });

        // 🕐 TIME-BASED GREETING NOTIFICATION (Once per day)
        try {
            const loginTime = moment().tz('Asia/Kathmandu');
            const startOfToday = loginTime.clone().startOf('day');
            const lastLogin = user.lastLoginAt ? moment(user.lastLoginAt).tz('Asia/Kathmandu') : null;
            const isFirstLoginToday = !lastLogin || lastLogin.isBefore(startOfToday);

            if (isFirstLoginToday) {
                const hour = loginTime.hour();
                let greeting = '';
                let motivationalMsg = '';

                if (hour < 6) {
                    greeting = 'Early Bird Alert! 🌙';
                    motivationalMsg = 'You\'re up before the sun! That\'s serious dedication. Let\'s make today count! 💪';
                } else if (hour < 10) {
                    greeting = 'Good Morning! ☀️';
                    motivationalMsg = 'Rise and grind! Morning workouts set the tone for a winning day. Let\'s go! 🔥';
                } else if (hour < 12) {
                    greeting = 'Late Morning Check-in! 🌤️';
                    motivationalMsg = 'Better late than never! Your body will thank you. Let\'s crush it! 💪';
                } else if (hour < 14) {
                    greeting = 'Afternoon Power! 🌞';
                    motivationalMsg = 'Lunch break workout? That\'s next level commitment! Keep pushing! 🏋️';
                } else if (hour < 17) {
                    greeting = 'Afternoon Hustle! 💪';
                    motivationalMsg = 'The afternoon session is all about focus and power. You\'ve got this! 🔥';
                } else if (hour < 20) {
                    greeting = 'Evening Warriors! 🌆';
                    motivationalMsg = 'Evening workouts = stress relief + gains. The perfect combo! 💥';
                } else {
                    greeting = 'Night Owl Mode! 🦉';
                    motivationalMsg = 'Late night grind! Respect the hustle. Make every rep count! 🏋️‍♂️';
                }

                let membershipInfo = '';
                if (user.membership?.expiryDate) {
                    const daysLeft = moment(user.membership.expiryDate).diff(loginTime, 'days');
                    if (daysLeft <= 3 && daysLeft >= 0) {
                        membershipInfo = ` ⚠️ Your membership expires in ${daysLeft} day(s)!`;
                    }
                }

                // Send personalized greeting to the logged-in member
                notificationService.sendNotification({
                    recipientId: user._id.toString(),
                    type: 'daily_greeting',
                    title: `${greeting}`,
                    message: `${motivationalMsg}${membershipInfo}`,
                    data: { type: 'daily_greeting' }
                }).catch(() => { });

                // 🔔 ADMIN LOGIN ALERT: Only notify admins on first login of the day
                const admins = await User.find({ role: { $in: ['admin', 'manager'] }, isActive: true });
                for (const admin of admins) {
                    notificationService.sendNotification({
                        recipientId: admin._id.toString(),
                        type: 'login_alert',
                        title: '🔑 Member Login Alert',
                        message: `${user.firstName} ${user.lastName} (${user.employeeId}) logged in for the first time today.`,
                        data: {
                            type: 'login_alert',
                            userId: user._id,
                            memberName: `${user.firstName} ${user.lastName}`
                        }
                    }).catch(() => { });
                }
            }

            // Always send real-time admin dashboard event (no data store, just broadcast)
            notificationService.sendAdminNotification('member_login', {
                userId: user._id,
                userName: `${user.firstName} ${user.lastName}`,
                employeeId: user.employeeId,
                profileImage: user.profileImage,
                loginTime: loginTime.format('HH:mm:ss'),
                membershipStatus: user.membership?.status
            });

            // Update last login timestamp
            user.lastLoginAt = new Date();
            await user.save();
        } catch (e) {
            console.error('Login notification error:', e);
        }

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
                    age: user.age,
                    gender: user.gender,
                    shift: user.shift,
                    profileImage: user.profileImage,
                    membership: user.membership
                },
                token
            }
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Login admin/manager
// @route   POST /api/auth/admin/login
// @access  Public
export const adminLogin = async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'Please provide email and password' });
        }

        const user = await User.findOne({ email });

        if (!user) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        // Check if user is admin, manager or reception
        if (user.role !== 'admin' && user.role !== 'manager' && user.role !== 'reception') {
            return res.status(403).json({ success: false, message: 'Access denied. Only admins, managers and reception can login here.' });
        }

        if (!user.isActive) {
            return res.status(401).json({ success: false, message: 'Your account has been deactivated' });
        }

        const isPasswordMatch = await user.comparePassword(password);

        if (!isPasswordMatch) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

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
                    role: user.role,
                    profileImage: user.profileImage
                },
                token
            }
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Create new admin/manager
// @route   POST /api/auth/admin/create
// @access  Private (Admin Only)
export const createAdmin = async (req: AuthRequest, res: Response) => {
    try {
        // Check if requester is admin (only admins can create other admins/managers)
        if (req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Not authorized to create admin accounts' });
        }

        const { employeeId, email, password, firstName, lastName, role } = req.body;

        if (!['admin', 'manager'].includes(role)) {
            return res.status(400).json({ success: false, message: 'Invalid role. Must be admin or manager.' });
        }

        const userExists = await User.findOne({ $or: [{ email }, { employeeId }] });

        if (userExists) {
            return res.status(400).json({
                success: false,
                message: 'User with this email or employee ID already exists'
            });
        }

        const profileImage = `https://api.dicebear.com/9.x/avataaars/png?seed=${email}`;

        const user = await User.create({
            employeeId,
            email,
            password,
            firstName,
            lastName,
            department: 'Management',
            role,
            profileImage,
            isActive: true
        });

        res.status(201).json({
            success: true,
            message: `${role.charAt(0).toUpperCase() + role.slice(1)} created successfully`,
            data: {
                id: user._id,
                employeeId: user.employeeId,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                role: user.role
            }
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
export const getMe = async (req: AuthRequest, res: Response) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        res.status(200).json({ success: true, data: user });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Update current user profile
// @route   PUT /api/auth/me
// @access  Private
export const updateProfile = async (req: AuthRequest, res: Response) => {
    try {
        const { firstName, lastName, password, preferredWorkoutStart, preferredWorkoutEnd, pushToken, notificationsEnabled } = req.body;

        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        if (firstName) user.firstName = firstName;
        if (lastName) user.lastName = lastName;
        if (password) user.password = password; // Pre-save hook will hash it
        if (preferredWorkoutStart) user.preferredWorkoutStart = preferredWorkoutStart;
        if (preferredWorkoutEnd) user.preferredWorkoutEnd = preferredWorkoutEnd;
        if (pushToken) user.pushToken = pushToken;
        if (notificationsEnabled !== undefined) user.notificationsEnabled = notificationsEnabled;

        await user.save();

        res.status(200).json({
            success: true,
            data: user
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
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
            return res.status(400).json({ success: false, message: 'Invalid membership plan' });
        }

        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // 🔒 RESTRICTION: Only expired or no membership can request new subscription
        if (user.membership && user.membership.status === 'active') {
            // Check if membership is truly active (not expired)
            const expiryDate = moment(user.membership.expiryDate);
            const now = moment();

            if (expiryDate.isAfter(now)) {
                return res.status(403).json({
                    success: false,
                    message: 'You already have an active membership. You can only request a new subscription after your current membership expires.'
                });
            }
        }

        // Check if there's already a pending request
        if (user.membership && user.membership.status === 'pending') {
            return res.status(400).json({
                success: false,
                message: 'You already have a pending membership request. Please wait for approval.'
            });
        }

        let start = startDate ? moment(startDate) : moment();
        let isRenewal = false;

        // If previous membership exists and is expired, this is a renewal
        if (user.membership && user.membership.status === 'expired') {
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
            startDate: start.toDate() as any,
            expiryDate: expiry.toDate() as any,
            status: 'pending',
            monthlyDayCount: user.membership?.monthlyDayCount || 0,
            lastResetDate: user.membership?.lastResetDate || moment().toDate() as any
        };

        await user.save();

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
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Approve Membership (Admin Only)
// @route   PUT /api/auth/membership/approve/:userId
// @access  Private (Admin)
export const approveMembership = async (req: AuthRequest, res: Response) => {
    try {
        if (req.user.role !== 'admin' && req.user.role !== 'manager' && req.user.role !== 'reception') {
            return res.status(403).json({ success: false, message: 'Not authorized' });
        }

        const user = await User.findById(req.params.userId);
        if (!user || !user.membership) {
            return res.status(404).json({ success: false, message: 'User or membership request not found' });
        }

        user.membership.status = 'active';
        await user.save();

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

// @desc    Get All Users (Admin Only)
export const getAllUsers = async (req: AuthRequest, res: Response) => {
    try {
        if (req.user.role !== 'admin' && req.user.role !== 'manager' && req.user.role !== 'reception') {
            return res.status(403).json({ success: false, message: 'Not authorized' });
        }

        const users = await User.find().select('-password');
        res.status(200).json({ success: true, data: users });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get Membership Status
export const getMembershipStatus = async (req: AuthRequest, res: Response) => {
    try {
        const user = await User.findById(req.user.id).select('membership');
        if (!user || !user.membership) {
            return res.status(200).json({ success: true, data: { plan: 'none', status: 'pending' } });
        }
        res.status(200).json({ success: true, data: user.membership });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Update User (Admin Only)
export const updateUser = async (req: AuthRequest, res: Response) => {
    try {
        const { password, ...updateData } = req.body;
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        if (req.user.role === 'manager') {
            if (user.role !== 'user') return res.status(403).json({ success: false, message: 'Not authorized' });
            if (updateData.role && updateData.role !== 'user') return res.status(403).json({ success: false, message: 'Not authorized' });
        } else if (req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Not authorized' });
        }

        if (password) user.password = password;
        Object.assign(user, updateData);
        await user.save();

        res.status(200).json({ success: true, message: 'User updated successfully', data: user });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Delete User (Admin Only)
export const deleteUser = async (req: AuthRequest, res: Response) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        if (req.user.role === 'manager') {
            if (user.role !== 'user') return res.status(403).json({ success: false, message: 'Not authorized' });
        } else if (req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Not authorized' });
        }

        await User.findByIdAndDelete(req.params.id);
        res.status(200).json({ success: true, message: 'User deleted successfully' });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};
