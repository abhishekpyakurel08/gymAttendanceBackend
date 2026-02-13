import mongoose from 'mongoose';
import { Request, Response } from 'express';
import User from '../models/User';
import { AuthRequest } from '../middleware/auth';
import path from 'path';
import fs from 'fs';

// @desc    Get user profile
// @route   GET /api/user/profile
// @access  Private
export const getProfile = async (req: AuthRequest, res: Response) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        res.status(200).json({ success: true, data: user });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Update user profile
// @route   PUT /api/user/profile
// @access  Private
// Re-using/Refining logic from authController if needed, strictly user-updatable fields
export const updateProfile = async (req: AuthRequest, res: Response) => {
    try {
        const { fullName, phoneNumber } = req.body; // Restricted to specific fields per prompt

        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        if (fullName) {
            const parts = fullName.split(' ');
            user.firstName = parts[0];
            user.lastName = parts.slice(1).join(' ') || '';
        }
        if (phoneNumber) user.phoneNumber = phoneNumber;

        await user.save();

        res.status(200).json({
            success: true,
            data: user
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Upload profile image
// @route   POST /api/user/profile/image
// @access  Private
export const uploadProfileImage = async (req: AuthRequest, res: Response) => {
    try {
        const file = (req as any).file;
        if (!file) {
            return res.status(400).json({ success: false, message: 'Please upload a file' });
        }

        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        let imageUrl = '';
        if (file.location) {
            // S3
            imageUrl = file.location;
        } else {
            // Local
            const protocol = req.protocol;
            const host = req.get('host');
            // Assuming static serve for 'uploads' folder is set up in app.ts/server.ts
            // We need to ensure app.use('/uploads', express.static('uploads')) exists!
            imageUrl = `${protocol}://${host}/uploads/${file.filename}`;
        }

        user.profileImage = imageUrl;
        await user.save();

        res.status(200).json({
            success: true,
            imageUrl: imageUrl,
            message: 'Profile image uploaded successfully'
        });

    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get user stats for profile
// @route   GET /api/user/stats
// @access  Private
export const getUserStats = async (req: AuthRequest, res: Response) => {
    try {
        const Attendance = require('../models/Attendance').default;

        const stats = await Attendance.aggregate([
            { $match: { userId: new mongoose.Types.ObjectId(req.user.id) } },
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 }
                }
            }
        ]);

        // Transform logic...
        const formattedStats = {
            daysPresent: 0,
            daysLate: 0,
            onTimeCheckIns: 0
        };

        let totalPresent = 0;

        stats.forEach((stat: any) => {
            if (stat._id === 'on-time') formattedStats.onTimeCheckIns = stat.count;
            if (stat._id === 'late') formattedStats.daysLate = stat.count;
            totalPresent += stat.count;
        });

        formattedStats.daysPresent = totalPresent;

        res.status(200).json({ success: true, data: formattedStats });

    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};
