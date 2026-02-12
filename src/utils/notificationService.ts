import { Server } from 'socket.io';
import Notification from '../models/Notification';
import User from '../models/User';
import logger from './logger';
import firebaseService from './firebaseService';

class NotificationService {
    private io: Server | null = null;
    private userSockets: Map<string, string[]> = new Map();

    init(io: Server) {
        this.io = io;

        this.io.on('connection', async (socket) => {
            const userId = socket.handshake.query.userId as string;
            const userRole = socket.handshake.query.role as string;

            if (userId) {
                const sockets = this.userSockets.get(userId) || [];
                sockets.push(socket.id);
                this.userSockets.set(userId, sockets);
                logger.info(`User ${userId} connected for notifications (Socket: ${socket.id})`);

                // If user is admin/manager, join them to the 'admin' room
                if (userRole === 'admin' || userRole === 'manager') {
                    socket.join('admin');
                    logger.info(`Admin ${userId} joined the real-time monitor room`);
                }

                socket.on('disconnect', () => {
                    const updatedSockets = (this.userSockets.get(userId) || []).filter(id => id !== socket.id);
                    if (updatedSockets.length > 0) {
                        this.userSockets.set(userId, updatedSockets);
                    } else {
                        this.userSockets.delete(userId);
                    }
                    logger.info(`User ${userId} disconnected from notifications`);
                });
            }
        });
    }

    /**
     * Send notification to a specific user
     */
    async sendNotification(params: {
        recipientId: string;
        type: 'membership_approved' | 'membership_expired' | 'clock_in' | 'clock_out' | 'system' | 'reminder' | 'announcement' | 'new_member' | 'membership_request' | 'expiry_warning' | 'inactivity_reminder';
        title: string;
        message: string;
        data?: any;
        senderId?: string;
    }) {
        try {
            const { recipientId, type, title, message, data, senderId } = params;

            // 1. Save to Database
            const notification = await Notification.create({
                recipient: recipientId,
                sender: senderId,
                type,
                title,
                message,
                data
            });

            // 2. Send via Socket.io (Real-time in-app alert)
            if (this.io) {
                const sockets = this.userSockets.get(recipientId);
                if (sockets && sockets.length > 0) {
                    sockets.forEach(socketId => {
                        this.io?.to(socketId).emit('notification', {
                            id: notification._id,
                            type,
                            title,
                            message,
                            data,
                            createdAt: notification.createdAt
                        });
                    });
                    logger.info(`Real-time notification sent to user ${recipientId}`);
                }
            }

            // 3. Trigger Actual Push Notification
            const user = await User.findById(recipientId).select('pushToken notificationsEnabled');
            if (user?.pushToken && user.notificationsEnabled) {
                await firebaseService.sendPushNotification(
                    user.pushToken,
                    title,
                    message,
                    data
                );
            }

            return notification;
        } catch (error: any) {
            logger.error(`Error sending notification: ${error.message}`);
            return null;
        }
    }

    /**
     * Send real-time event to all connected admins
     */
    sendAdminNotification(event: string, data: any) {
        if (this.io) {
            this.io.to('admin').emit(event, data);
            logger.info(`Admin event '${event}' broadcasted to all active admins`);
        }
    }

    /**
     * Broadcast notification to ALL users
     */
    async broadcastNotification(params: {
        title: string;
        message: string;
        senderId?: string;
        data?: any;
    }) {
        try {
            const { title, message, senderId, data } = params;

            // 1. Get all active users
            const users = await User.find({ isActive: true }).select('_id pushToken notificationsEnabled');

            // 2. Save notifications in bulk
            const notificationRecords = users.map(user => ({
                recipient: user._id,
                sender: senderId,
                type: 'system',
                title,
                message,
                data
            }));

            await Notification.insertMany(notificationRecords);

            // 3. Emit via Socket.io broadcast
            if (this.io) {
                this.io.emit('notification', {
                    type: 'system',
                    title,
                    message,
                    data,
                    createdAt: new Date()
                });
            }

            // 4. Send Firebase Push to all tokens
            const tokens = users
                .filter(u => u.pushToken && u.notificationsEnabled)
                .map(u => u.pushToken as string);

            if (tokens.length > 0) {
                await firebaseService.sendMulticastNotification(tokens, title, message, data);
            }

            return { success: true, count: users.length };
        } catch (error: any) {
            logger.error(`Error broadcasting notification: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    /**
     * Send notifications to a list of specific users (Selected group)
     */
    async sendMultipleNotifications(params: {
        userIds: string[];
        type: 'membership_approved' | 'membership_expired' | 'clock_in' | 'clock_out' | 'system' | 'reminder' | 'announcement' | 'new_member' | 'membership_request' | 'expiry_warning' | 'inactivity_reminder';
        title: string;
        message: string;
        data?: any;
        senderId?: string;
    }) {
        try {
            const { userIds, type, title, message, data, senderId } = params;

            // 1. Get user details for push tokens
            const users = await User.find({ _id: { $in: userIds } }).select('_id pushToken notificationsEnabled');

            // 2. Save notifications in bulk
            const notificationRecords = users.map(user => ({
                recipient: user._id,
                sender: senderId,
                type,
                title,
                message,
                data
            }));
            await Notification.insertMany(notificationRecords);

            // 3. Emit via Socket.io to each connected user
            if (this.io) {
                users.forEach(user => {
                    const sockets = this.userSockets.get(user._id.toString());
                    if (sockets && sockets.length > 0) {
                        sockets.forEach(socketId => {
                            this.io?.to(socketId).emit('notification', {
                                type,
                                title,
                                message,
                                data,
                                createdAt: new Date()
                            });
                        });
                    }
                });
            }

            // 4. Send Firebase Push to all tokens in this group
            const tokens = users
                .filter(u => u.pushToken && u.notificationsEnabled)
                .map(u => u.pushToken as string);

            if (tokens.length > 0) {
                await firebaseService.sendMulticastNotification(tokens, title, message, data);
            }

            return { success: true, count: users.length };
        } catch (error: any) {
            logger.error(`Error sending group notifications: ${error.message}`);
            return { success: false, error: error.message };
        }
    }
}

export default new NotificationService();
