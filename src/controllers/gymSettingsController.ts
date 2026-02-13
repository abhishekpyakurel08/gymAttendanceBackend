import { Request, Response } from 'express';
import GymSettings from '../models/GymSettings';
import { AuthRequest } from '../middleware/auth';
import moment from 'moment-timezone';

// @desc    Get gym settings including operating hours
// @route   GET /api/gym-settings
// @access  Public
export const getGymSettings = async (req: Request, res: Response) => {
    try {
        let settings = await GymSettings.findOne();

        // If no settings exist, create default settings
        if (!settings) {
            settings = await GymSettings.create({
                gymName: 'Shankhamul Gym',
                timezone: 'Asia/Kathmandu',
                operatingHours: {
                    monday: { isOpen: true, openTime: '05:00', closeTime: '20:00' },
                    tuesday: { isOpen: true, openTime: '05:00', closeTime: '20:00' },
                    wednesday: { isOpen: true, openTime: '05:00', closeTime: '20:00' },
                    thursday: { isOpen: true, openTime: '05:00', closeTime: '20:00' },
                    friday: { isOpen: true, openTime: '05:00', closeTime: '20:00' },
                    saturday: { isOpen: false, openTime: '05:00', closeTime: '20:00' },
                    sunday: { isOpen: true, openTime: '05:00', closeTime: '20:00' }
                }
            });
        }

        res.status(200).json({ success: true, data: settings });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Update gym settings
// @route   PUT /api/gym-settings
// @access  Private (Admin/Manager)
export const updateGymSettings = async (req: AuthRequest, res: Response) => {
    try {
        const { operatingHours, gymName, gymAddress, gymPhone, gymEmail, timezone } = req.body;

        let settings = await GymSettings.findOne();

        if (!settings) {
            settings = await GymSettings.create({
                operatingHours,
                gymName,
                gymAddress,
                gymPhone,
                gymEmail,
                timezone: timezone || 'Asia/Kathmandu',
                updatedBy: req.user.id,
                updatedAt: new Date()
            });
        } else {
            if (operatingHours) settings.operatingHours = operatingHours;
            if (gymName) settings.gymName = gymName;
            if (gymAddress !== undefined) settings.gymAddress = gymAddress;
            if (gymPhone !== undefined) settings.gymPhone = gymPhone;
            if (gymEmail !== undefined) settings.gymEmail = gymEmail;
            if (timezone) settings.timezone = timezone;
            settings.updatedBy = req.user.id;
            settings.updatedAt = new Date();

            await settings.save();
        }

        res.status(200).json({
            success: true,
            message: 'Gym settings updated successfully',
            data: settings
        });

        // 🔄 BROADCAST TO ALL CLIENTS
        const notificationService = require('../utils/notificationService').default;
        notificationService.sendAdminNotification('gym_settings_updated', { settings });
        notificationService.sendBroadcastNotification('gym_settings_updated', { settings });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Check if gym is currently open
// @route   GET /api/gym-settings/status
// @access  Public
export const getGymStatus = async (req: Request, res: Response) => {
    try {
        const settings = await GymSettings.findOne();

        if (!settings) {
            return res.status(200).json({
                success: true,
                data: { isOpen: false, message: 'Gym settings not configured' }
            });
        }

        const now = moment().tz(settings.timezone);
        const dayOfWeek = now.format('dddd').toLowerCase() as keyof typeof settings.operatingHours;
        const currentTime = now.format('HH:mm');

        const todayHours = settings.operatingHours[dayOfWeek];

        if (!todayHours || !todayHours.isOpen) {
            return res.status(200).json({
                success: true,
                data: {
                    isOpen: false,
                    message: 'Gym is closed today',
                    todayHours: null,
                    currentTime,
                    dayOfWeek
                }
            });
        }

        const isCurrentlyOpen = currentTime >= todayHours.openTime && currentTime <= todayHours.closeTime;

        res.status(200).json({
            success: true,
            data: {
                isOpen: isCurrentlyOpen,
                message: isCurrentlyOpen ? 'Gym is currently open' : 'Gym is currently closed',
                todayHours: {
                    openTime: todayHours.openTime,
                    closeTime: todayHours.closeTime
                },
                currentTime,
                dayOfWeek,
                gymName: settings.gymName
            }
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};
