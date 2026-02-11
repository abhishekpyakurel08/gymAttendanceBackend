import { Response } from 'express';
import Measurement from '../models/Measurement';
import User from '../models/User';
import { AuthRequest } from '../middleware/auth';

/**
 * @desc    Add new measurement for a member
 * @route   POST /api/measurements
 * @access  Private (Admin/Manager/Trainer)
 */
export const addMeasurement = async (req: AuthRequest, res: Response) => {
    try {
        const { userId, weight, height, bodyFatPercentage, chest, waist, arms, legs, notes, date } = req.body;

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const measurement = await Measurement.create({
            userId,
            recordedBy: req.user.id,
            date: date || new Date(),
            weight,
            height,
            bodyFatPercentage,
            chest,
            waist,
            arms,
            legs,
            notes
        });

        res.status(201).json({
            success: true,
            data: measurement
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Get measurement history for a member
 * @route   GET /api/measurements/user/:userId
 * @access  Private
 */
export const getUserMeasurements = async (req: AuthRequest, res: Response) => {
    try {
        const { userId } = req.params;

        // Allow users to see their own, or admins/managers/staff to see any
        if (req.user.id !== userId && req.user.role === 'user') {
            return res.status(403).json({ success: false, message: 'Not authorized' });
        }

        const measurements = await Measurement.find({ userId })
            .sort({ date: -1 })
            .populate('recordedBy', 'firstName lastName');

        res.status(200).json({
            success: true,
            count: measurements.length,
            data: measurements
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Get latest measurement for a member (Progress overview)
 * @route   GET /api/measurements/user/:userId/latest
 * @access  Private
 */
export const getLatestMeasurement = async (req: AuthRequest, res: Response) => {
    try {
        const { userId } = req.params;

        if (req.user.id !== userId && req.user.role === 'user') {
            return res.status(403).json({ success: false, message: 'Not authorized' });
        }

        const latest = await Measurement.findOne({ userId }).sort({ date: -1 });

        if (!latest) {
            return res.status(404).json({ success: false, message: 'No measurements found' });
        }

        res.status(200).json({
            success: true,
            data: latest
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};
