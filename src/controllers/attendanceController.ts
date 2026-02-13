import { Response } from 'express';
import moment from 'moment-timezone';
import Attendance from '../models/Attendance';
import User from '../models/User';
import { AuthRequest } from '../middleware/auth';
import notificationService from '../utils/notificationService';
import mongoose from 'mongoose';
import logger from '../utils/logger';

// @desc    Get absent members for today
// @route   GET /api/attendance/admin/absent
// @access  Admin/Manager
export const getAbsentMembersToday = async (req: AuthRequest, res: Response) => {
    try {
        const today = moment().startOf('day');
        const tomorrow = moment(today).add(1, 'day');

        // Get all active users with role 'user'
        const allMembers = await User.find({ role: 'user', isActive: true });
        const allMemberIds = allMembers.map(u => u._id.toString());

        // Get all attendance records for today
        const attendanceToday = await Attendance.find({
            userId: { $in: allMemberIds },
            date: { $gte: today.toDate(), $lt: tomorrow.toDate() }
        });
        const presentIds = new Set(attendanceToday.map(a => a.userId.toString()));

        // Filter members who are not present
        const absentMembers = allMembers.filter(u => !presentIds.has(u._id.toString()));

        res.status(200).json({
            success: true,
            count: absentMembers.length,
            data: absentMembers.map(u => ({
                id: u._id,
                employeeId: u.employeeId,
                email: u.email,
                firstName: u.firstName,
                lastName: u.lastName,
                department: u.department,
                profileImage: u.profileImage,
                membership: u.membership
            }))
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const OFFICE_START_TIME = process.env.OFFICE_START_TIME || '09:00';


const LATE_THRESHOLD = parseInt(process.env.LATE_THRESHOLD_MINUTES || '15');
const TIMEZONE = process.env.DEFAULT_TIMEZONE || 'Asia/Kathmandu';

// 📍 Shankhamul Gym Location (Kathmandu, Nepal)
const GYM_LATITUDE = 27.684185017430245;
const GYM_LONGITUDE = 85.33338702577204;
const GYM_RADIUS_METERS = 100; // 100 meter radius

/**
 * Calculate distance between two GPS coordinates using Haversine formula
 * Returns distance in meters
 */
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
}

import Location from '../models/Location';

// ... (existing imports)

// ... (existing constants)

/**
 * Validate if coordinates are within ANY active gym geo-fence
 * Returns details about validation
 */
async function validateGeofence(latitude: number, longitude: number): Promise<{ isValid: boolean, message?: string, distance?: number }> {
    const locations = await Location.find({ isActive: true });

    // Fallback to hardcoded if no locations in DB
    if (locations.length === 0) {
        const dist = calculateDistance(GYM_LATITUDE, GYM_LONGITUDE, latitude, longitude);
        if (dist <= GYM_RADIUS_METERS) return { isValid: true };
        return { isValid: false, distance: Math.round(dist), message: `You are ${Math.round(dist)}m away from the gym.` };
    }

    let minDistance = Infinity;
    let isValid = false;

    for (const loc of locations) {
        const dist = calculateDistance(loc.latitude, loc.longitude, latitude, longitude);
        if (dist < minDistance) minDistance = dist;
        if (dist <= loc.radius) {
            isValid = true;
            break;
        }
    }

    if (isValid) return { isValid: true };
    return { isValid: false, distance: Math.round(minDistance), message: `You are ${Math.round(minDistance)}m away from the nearest gym location.` };
}

// @desc    Clock in
// @route   POST /api/attendance/clock-in
// @access  Private
export const clockIn = async (req: AuthRequest, res: Response) => {
    try {
        const { latitude, longitude, address } = req.body;

        if (!latitude || !longitude) {
            return res.status(400).json({
                success: false,
                message: 'Location coordinates are required'
            });
        }

        // 🔒 GEO-FENCE VALIDATION (Dynamic)
        const geofence = await validateGeofence(latitude, longitude);
        if (!geofence.isValid) {
            return res.status(403).json({
                success: false,
                message: geofence.message || `You must be at the gym to check in.`
            });
        }

        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // --- Gym Operating Hours Validation ---
        const now = moment().tz(TIMEZONE);
        const dayOfWeek = now.day(); // 0 (Sun) to 6 (Sat)
        const hour = now.hour();

        // 1. Check if Saturday (Closed)
        if (dayOfWeek === 6) {
            return res.status(403).json({
                success: false,
                message: 'Gym is closed on Saturdays.'
            });
        }

        // 2. Check Operating Hours (05:00 - 20:00)
        // Adjust these variables as needed or move to env vars
        const OPEN_HOUR = 5;
        const CLOSE_HOUR = 20;

        if (hour < OPEN_HOUR || hour >= CLOSE_HOUR) {
            return res.status(403).json({
                success: false,
                message: `Gym is closed. Operating hours are ${OPEN_HOUR}:00 to ${CLOSE_HOUR}:00.`
            });
        }

        // --- Membership & 26-Day Rule Validation ---

        // Reset monthly count if it's a new month
        const lastReset = moment(user.membership?.lastResetDate).tz(TIMEZONE);

        if (now.month() !== lastReset.month() || now.year() !== lastReset.year()) {
            if (user.membership) {
                user.membership.monthlyDayCount = 0;
                user.membership.lastResetDate = now.toDate();
            }
        }

        // 1. Check if membership exists
        if (!user.membership || user.membership.plan === 'none' || user.membership.status !== 'active') {
            const statusMsg = user.membership?.status === 'pending'
                ? 'Your membership is pending admin approval'
                : 'Active gym membership required to clock in';

            return res.status(403).json({
                success: false,
                message: statusMsg
            });
        }

        // 2. Check 26-day monthly limit
        if (user.membership.monthlyDayCount >= 26) {
            return res.status(403).json({
                success: false,
                message: 'Monthly limit of 26 days reached'
            });
        }

        // 3. Check if membership is expired
        const expiryDate = moment(user.membership.expiryDate);
        if (now.isAfter(expiryDate)) {
            user.membership.status = 'expired';
            await user.save();
            return res.status(403).json({
                success: false,
                message: 'Your membership has expired. Please renew.'
            });
        }

        // 4. Detect 3-day expiry warning
        const diffDays = expiryDate.diff(now, 'days');
        let notificationMsg = null;
        if (diffDays <= 3 && diffDays >= 0) {
            notificationMsg = `Your membership expires in ${diffDays} days! Please renew soon.`;
        }

        const today = moment().tz(TIMEZONE).startOf('day').toDate();
        const clockInDate = now.toDate();

        // Check if already clocked in today
        const existingAttendance = await Attendance.findOne({
            userId: req.user.id,
            date: today
        });

        if (existingAttendance) {
            return res.status(400).json({
                success: false,
                message: 'You have already clocked in today'
            });
        }

        // Determine if late
        const officeStart = moment(today).tz(TIMEZONE).set({
            hour: parseInt(OFFICE_START_TIME.split(':')[0]),
            minute: parseInt(OFFICE_START_TIME.split(':')[1])
        });

        const diffMinutes = now.diff(officeStart, 'minutes');
        const status = diffMinutes > LATE_THRESHOLD ? 'late' : 'on-time';

        // Create attendance record
        const attendance = await Attendance.create({
            userId: req.user.id,
            date: today,
            clockIn: clockInDate,
            status,
            location: {
                latitude,
                longitude,
                address
            }
        });

        // Increment monthly day count
        if (user.membership) {
            user.membership.monthlyDayCount += 1;
            user.membership.status = 'active';
            await user.save();
        }

        // Trigger Notification
        await notificationService.sendNotification({
            recipientId: user._id.toString(),
            type: 'clock_in',
            title: 'Welcome to the Gym! 💪',
            message: `You clocked in successfully at ${now.format('LT')}${status === 'late' ? ' (Late arrival)' : ''}.`,
            data: { attendanceId: attendance._id }
        });

        // 🟢 REAL-TIME MONITOR FOR ADMIN
        notificationService.sendAdminNotification('user_clock_in', {
            attendanceId: attendance._id,
            userId: user._id,
            userName: `${user.firstName} ${user.lastName}`,
            profileImage: user.profileImage,
            time: now.format('HH:mm:ss'),
            status: status
        });

        res.status(201).json({
            success: true,
            data: attendance,
            notification: notificationMsg // Send warning if expiry is close
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// @desc    Clock out
// @route   PUT /api/attendance/clock-out
// @access  Private
export const clockOut = async (req: AuthRequest, res: Response) => {
    try {
        const { latitude, longitude, address } = req.body;

        const today = moment().tz(TIMEZONE).startOf('day').toDate();
        const now = moment().tz(TIMEZONE);

        // Find today's attendance record
        const attendance = await Attendance.findOne({
            userId: req.user.id,
            date: today
        });

        if (!attendance) {
            return res.status(400).json({
                success: false,
                message: 'No clock-in record found for today'
            });
        }

        if (attendance.clockOut) {
            return res.status(400).json({
                success: false,
                message: 'You have already clocked out today'
            });
        }

        // 🔒 GEO-FENCE VALIDATION (Clock-out must also be at gym)
        if (latitude && longitude) {
            const geofence = await validateGeofence(latitude, longitude);
            if (!geofence.isValid) {
                return res.status(403).json({
                    success: false,
                    message: geofence.message || `You must be at the gym to check out.`
                });
            }
        }

        // Update with clock out info
        attendance.clockOut = now.toDate();
        attendance.clockOutLocation = {
            latitude,
            longitude,
            address
        };

        await attendance.save();

        // Trigger Notification
        await notificationService.sendNotification({
            recipientId: req.user.id,
            type: 'clock_out',
            title: 'Workout Finished! 🏁',
            message: `Well done! You clocked out at ${now.format('LT')}. See you next time!`,
            data: { attendanceId: attendance._id }
        });

        // 🔴 REAL-TIME MONITOR FOR ADMIN
        notificationService.sendAdminNotification('user_clock_out', {
            attendanceId: attendance._id,
            userId: req.user.id,
            time: now.format('HH:mm:ss'),
        });

        res.status(200).json({
            success: true,
            data: attendance
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// @desc    Get my attendance history
// @route   GET /api/attendance/my-history
// @access  Private
export const getMyHistory = async (req: AuthRequest, res: Response) => {
    try {
        const { startDate, endDate, page = 1, limit = 10 } = req.query;

        const query: any = { userId: req.user.id };

        if (startDate || endDate) {
            query.date = {};
            if (startDate) query.date.$gte = new Date(startDate as string);
            if (endDate) query.date.$lte = new Date(endDate as string);
        }

        const skip = (Number(page) - 1) * Number(limit);

        const [attendances, total] = await Promise.all([
            Attendance.find(query)
                .sort({ date: -1 })
                .skip(skip)
                .limit(Number(limit)),
            Attendance.countDocuments(query)
        ]);

        res.status(200).json({
            success: true,
            data: attendances,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
                pages: Math.ceil(total / Number(limit))
            }
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// @desc    Get today's status
// @route   GET /api/attendance/today
// @access  Private
export const getTodayStatus = async (req: AuthRequest, res: Response) => {
    try {
        const today = moment().tz(TIMEZONE).startOf('day').toDate();

        const attendance = await Attendance.findOne({
            userId: req.user.id,
            date: today
        });

        res.status(200).json({
            success: true,
            data: attendance
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// @desc    Get attendance statistics
// @route   GET /api/attendance/stats
// @access  Private
export const getStats = async (req: AuthRequest, res: Response) => {
    try {
        const { startDate, endDate } = req.query;

        const matchQuery: any = { userId: new mongoose.Types.ObjectId(req.user.id) };

        if (startDate || endDate) {
            matchQuery.date = {};
            if (startDate) matchQuery.date.$gte = new Date(startDate as string);
            if (endDate) matchQuery.date.$lte = new Date(endDate as string);
        }

        const stats = await Attendance.aggregate([
            { $match: matchQuery },
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 }
                }
            }
        ]);

        const formattedStats = {
            'on-time': 0,
            'late': 0,
            'absent': 0,
            'half-day': 0
        };

        stats.forEach(stat => {
            formattedStats[stat._id as keyof typeof formattedStats] = stat.count;
        });

        const total = await Attendance.countDocuments(matchQuery);

        // Sum of on-time, late, and half-day for total present
        const totalPresent = formattedStats['on-time'] + formattedStats['late'] + formattedStats['half-day'];

        res.status(200).json({
            success: true,
            data: {
                totalPresent,
                totalOnTime: formattedStats['on-time'],
                totalLate: formattedStats['late'],
                totalAbsent: formattedStats['absent'],
                totalRecords: total
            }
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};
// @desc    Get all attendance for today (Admin Only)
// @route   GET /api/attendance/admin/today
// @access  Private (Admin)
export const getTodayAttendanceAll = async (req: AuthRequest, res: Response) => {
    try {
        if (req.user.role !== 'admin' && req.user.role !== 'manager') {
            return res.status(403).json({ success: false, message: 'Not authorized' });
        }

        const today = moment().tz(TIMEZONE).startOf('day').toDate();

        const attendances = await Attendance.find({ date: today })
            .populate('userId', 'firstName lastName email employeeId department profileImage')
            .sort({ clockIn: -1 });

        res.status(200).json({
            success: true,
            count: attendances.length,
            data: attendances
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get any user's attendance history (Admin Only)
// @route   GET /api/attendance/admin/user/:userId
// @access  Private (Admin)
export const getMemberHistory = async (req: AuthRequest, res: Response) => {
    try {
        if (req.user.role !== 'admin' && req.user.role !== 'manager') {
            return res.status(403).json({ success: false, message: 'Not authorized' });
        }

        const { userId } = req.params;
        const { startDate, endDate, page = 1, limit = 20 } = req.query;

        const query: any = { userId };

        if (startDate || endDate) {
            query.date = {};
            if (startDate) query.date.$gte = new Date(startDate as string);
            if (endDate) query.date.$lte = new Date(endDate as string);
        }

        const skip = (Number(page) - 1) * Number(limit);

        const [attendances, total] = await Promise.all([
            Attendance.find(query)
                .sort({ date: -1 })
                .skip(skip)
                .limit(Number(limit)),
            Attendance.countDocuments(query)
        ]);

        res.status(200).json({
            success: true,
            data: attendances,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
                pages: Math.ceil(total / Number(limit))
            }
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};
// @desc    Admin/Staff Manual Clock In for User
// @route   POST /api/attendance/admin/clock-in
// @access  Private (Admin/Manager/Staff)
export const adminClockIn = async (req: AuthRequest, res: Response) => {
    try {
        if (req.user.role !== 'admin' && req.user.role !== 'manager' && req.user.role !== 'reception') {
            return res.status(403).json({ success: false, message: 'Not authorized' });
        }

        const { userId } = req.body;
        if (!userId) {
            return res.status(400).json({ success: false, message: 'User ID is required' });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const now = moment().tz(TIMEZONE);
        const today = now.clone().startOf('day').toDate();

        // Check if already clocked in
        const existingAttendance = await Attendance.findOne({
            userId: user._id,
            date: today
        });

        if (existingAttendance) {
            return res.status(400).json({
                success: false,
                message: 'User is already clocked in for today'
            });
        }

        // --- Membership Validation (Optional bypass for admins? No, rules should apply usually) ---
        // We will enforce rules but allow overriding via 'force' param if needed later.
        // For now, enforce basic active membership.
        if (!user.membership || user.membership.status !== 'active') {
            // Allow admin to override? For now, just warn.
            // If we want to block, uncomment below:
            // return res.status(400).json({ success: false, message: 'User membership is not active' });
        }

        // Determine lateness
        const officeStart = moment(today).tz(TIMEZONE).set({
            hour: parseInt(OFFICE_START_TIME.split(':')[0]),
            minute: parseInt(OFFICE_START_TIME.split(':')[1])
        });

        const diffMinutes = now.diff(officeStart, 'minutes');
        const status = diffMinutes > LATE_THRESHOLD ? 'late' : 'on-time';

        // Create record
        const attendance = await Attendance.create({
            userId: user._id,
            date: today,
            clockIn: now.toDate(),
            status,
            location: {
                address: 'Manual Check-in by ' + req.user.firstName,
                latitude: GYM_LATITUDE,
                longitude: GYM_LONGITUDE
            }
        });

        // Increment monthly count if applicable
        if (user.membership && user.membership.status === 'active') {
            // Reset logic is complex, assuming standard flow
            const lastReset = moment(user.membership.lastResetDate).tz(TIMEZONE);
            if (now.month() !== lastReset.month() || now.year() !== lastReset.year()) {
                user.membership.monthlyDayCount = 1;
                user.membership.lastResetDate = now.toDate();
            } else {
                user.membership.monthlyDayCount += 1;
            }
            await user.save();
        }

        // Notifications
        await notificationService.sendNotification({
            recipientId: user._id.toString(),
            type: 'clock_in',
            title: 'Checked In by Staff  receptionist',
            message: `Reception marked you as present at ${now.format('LT')}.`,
            data: { attendanceId: attendance._id }
        });

        res.status(201).json({
            success: true,
            data: attendance,
            message: 'User checked in successfully'
        });

        // 🟢 REAL-TIME MONITOR FOR ADMIN
        notificationService.sendAdminNotification('user_clock_in', {
            attendanceId: attendance._id,
            userId: user._id,
            userName: `${user.firstName} ${user.lastName}`,
            profileImage: user.profileImage,
            time: now.format('HH:mm:ss'),
            status: status
        });

    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Admin/Staff Manual Clock Out for User
// @route   POST /api/attendance/admin/clock-out
// @access  Private (Admin/Manager/Staff)
export const adminClockOut = async (req: AuthRequest, res: Response) => {
    try {
        if (req.user.role !== 'admin' && req.user.role !== 'manager' && req.user.role !== 'reception') {
            return res.status(403).json({ success: false, message: 'Not authorized' });
        }

        const { userId } = req.body;
        if (!userId) {
            return res.status(400).json({ success: false, message: 'User ID is required' });
        }

        const now = moment().tz(TIMEZONE);
        const today = now.clone().startOf('day').toDate();

        const attendance = await Attendance.findOne({
            userId: userId,
            date: today
        });

        if (!attendance) {
            return res.status(400).json({ success: false, message: 'User has not clocked in today' });
        }

        if (attendance.clockOut) {
            return res.status(400).json({ success: false, message: 'User is already clocked out' });
        }

        attendance.clockOut = now.toDate();
        attendance.clockOutLocation = {
            address: 'Manual Check-out by ' + req.user.firstName,
            latitude: GYM_LATITUDE,
            longitude: GYM_LONGITUDE
        };

        await attendance.save();

        // Notification
        await notificationService.sendNotification({
            recipientId: userId,
            type: 'clock_out',
            title: 'Checked Out by Staff',
            message: `Reception marked your session complete at ${now.format('LT')}.`,
            data: { attendanceId: attendance._id }
        });

        res.status(200).json({
            success: true,
            data: attendance,
            message: 'User checked out successfully'
        });

        // 🔴 REAL-TIME MONITOR FOR ADMIN
        notificationService.sendAdminNotification('user_clock_out', {
            attendanceId: attendance._id,
            userId: userId,
            time: now.format('HH:mm:ss'),
        });

    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Manual attendance log (Admin Only)
// @route   POST /api/attendance/admin/manual
// @access  Private (Admin)
export const manualClock = async (req: AuthRequest, res: Response) => {
    try {
        if (req.user.role !== 'admin' && req.user.role !== 'manager' && req.user.role !== 'reception') {
            return res.status(403).json({ success: false, message: 'Not authorized' });
        }

        const { userId, date, clockIn, clockOut, status } = req.body;

        if (!userId || !date || !clockIn) {
            return res.status(400).json({ success: false, message: 'User ID, date and clock-in time are required' });
        }

        const logDate = moment(date).tz(TIMEZONE).startOf('day').toDate();
        const clockInDate = moment(clockIn).toDate();
        const clockOutDate = clockOut ? moment(clockOut).toDate() : undefined;

        let attendance = await Attendance.findOne({ userId, date: logDate });

        if (attendance) {
            attendance.clockIn = clockInDate;
            if (clockOutDate) attendance.clockOut = clockOutDate;
            if (status) attendance.status = status;
            await attendance.save();
        } else {
            attendance = await Attendance.create({
                userId,
                date: logDate,
                clockIn: clockInDate,
                clockOut: clockOutDate,
                status: status || 'on-time',
                location: {
                    latitude: GYM_LATITUDE,
                    longitude: GYM_LONGITUDE,
                    address: 'Manual Entry by Admin'
                }
            });
        }

        res.status(200).json({
            success: true,
            data: attendance
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Delete attendance record (Admin Only)
// @route   DELETE /api/attendance/admin/:id
// @access  Private (Admin)
export const deleteAttendance = async (req: AuthRequest, res: Response) => {
    try {
        if (req.user.role !== 'admin' && req.user.role !== 'manager' && req.user.role !== 'reception') {
            return res.status(403).json({ success: false, message: 'Not authorized' });
        }

        const attendance = await Attendance.findById(req.params.id);
        if (!attendance) return res.status(404).json({ success: false, message: 'Record not found' });

        await Attendance.findByIdAndDelete(req.params.id);

        res.status(200).json({ success: true, message: 'Attendance record deleted' });

        // 🔄 REAL-TIME NOTIFY
        notificationService.sendAdminNotification('attendance_deleted', {
            attendanceId: req.params.id
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};
