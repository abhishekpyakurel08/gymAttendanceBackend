import { Response } from 'express';
import Notification from '../models/Notification';
import User from '../models/User';
import { AuthRequest } from '../middleware/auth';
import logger from '../utils/logger';
import notificationService from '../utils/notificationService';

// @desc    Get all notifications for logged in user
// @route   GET /api/notifications
// @access  Private
export const getNotifications = async (req: AuthRequest, res: Response) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const skip = (page - 1) * limit;

        const notifications = await Notification.find({ recipient: req.user.id })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const total = await Notification.countDocuments({ recipient: req.user.id });

        res.status(200).json({
            success: true,
            count: notifications.length,
            total,
            pagination: {
                page,
                limit,
                pages: Math.ceil(total / limit)
            },
            data: notifications
        });
    } catch (error: any) {
        logger.error(`Error getting notifications: ${error.message}`);
        res.status(500).json({
            success: false,
            message: 'Server Error'
        });
    }
};

// @desc    Mark notification as read
// @route   PUT /api/notifications/:id/read
// @access  Private
export const markAsRead = async (req: AuthRequest, res: Response) => {
    try {
        const notification = await Notification.findById(req.params.id);

        if (!notification) {
            return res.status(404).json({
                success: false,
                message: 'Notification not found'
            });
        }

        // Make sure user owns this notification
        if (notification.recipient.toString() !== req.user.id) {
            return res.status(401).json({
                success: false,
                message: 'Not authorized'
            });
        }

        notification.isRead = true;
        await notification.save();

        res.status(200).json({
            success: true,
            data: notification
        });
    } catch (error: any) {
        logger.error(`Error marking notification read: ${error.message}`);
        res.status(500).json({
            success: false,
            message: 'Server Error'
        });
    }
};

// @desc    Mark all notifications as read
// @route   PUT /api/notifications/read-all
// @access  Private
export const markAllAsRead = async (req: AuthRequest, res: Response) => {
    try {
        await Notification.updateMany(
            { recipient: req.user.id, isRead: false },
            { isRead: true }
        );

        res.status(200).json({
            success: true,
            message: 'All notifications marked as read'
        });
    } catch (error: any) {
        logger.error(`Error marking all notifications read: ${error.message}`);
        res.status(500).json({
            success: false,
            message: 'Server Error'
        });
    }
};

// @desc    Delete notification
// @route   DELETE /api/notifications/:id
// @access  Private
export const deleteNotification = async (req: AuthRequest, res: Response) => {
    try {
        const notification = await Notification.findById(req.params.id);

        if (!notification) {
            return res.status(404).json({
                success: false,
                message: 'Notification not found'
            });
        }

        // Make sure user owns this notification
        if (notification.recipient.toString() !== req.user.id) {
            return res.status(401).json({
                success: false,
                message: 'Not authorized'
            });
        }

        await notification.deleteOne();

        res.status(200).json({
            success: true,
            message: 'Notification removed'
        });
    } catch (error: any) {
        logger.error(`Error deleting notification: ${error.message}`);
        res.status(500).json({
            success: false,
            message: 'Server Error'
        });
    }
};

// @desc    Send targeted group notification
// @route   POST /api/notifications/targeted
// @access  Private (Admin)
export const sendTargetedNotification = async (req: AuthRequest, res: Response) => {
    try {
        if (req.user.role !== 'admin' && req.user.role !== 'manager') {
            return res.status(403).json({ success: false, message: 'Not authorized for group messaging' });
        }

        const { title, message, gender, minAge, maxAge, type = 'announcement' } = req.body;

        if (!title || !message) {
            return res.status(400).json({ success: false, message: 'Title and message are required' });
        }

        // Build search query
        const query: any = { role: 'user' };
        if (gender && gender !== 'all') query.gender = gender;

        if (minAge || maxAge) {
            query.age = {};
            if (minAge) query.age.$gte = Number(minAge);
            if (maxAge) query.age.$lte = Number(maxAge);
        }

        const users = await User.find(query).select('_id pushToken');

        if (users.length === 0) {
            return res.status(404).json({ success: false, message: 'No users found matching these criteria' });
        }

        // Send notifications using the service (async)
        const sendPromises = users.map(user =>
            notificationService.sendNotification({
                recipientId: user._id.toString(),
                type,
                title,
                message,
                data: { sentBy: req.user.id }
            })
        );

        await Promise.all(sendPromises);

        res.status(200).json({
            success: true,
            message: `Notification sent to ${users.length} users successfully`
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};
