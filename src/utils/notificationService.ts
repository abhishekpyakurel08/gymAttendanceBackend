import { Server } from 'socket.io';
import Notification from '../models/Notification';
import User from '../models/User';
import logger from './logger';

class NotificationService {
    private io: Server | null = null;
    private userSockets: Map<string, string[]> = new Map();

    init(io: Server) {
        this.io = io;

        this.io.on('connection', (socket) => {
            const userId = socket.handshake.query.userId as string;

            if (userId) {
                const sockets = this.userSockets.get(userId) || [];
                sockets.push(socket.id);
                this.userSockets.set(userId, sockets);
                logger.info(`User ${userId} connected for notifications (Socket: ${socket.id})`);

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

    async sendNotification(params: {
        recipientId: string;
        type: 'membership_approved' | 'membership_expired' | 'clock_in' | 'clock_out' | 'system' | 'reminder';
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

            // 3. (Optional Architecture) Trigger Actual Push Notification
            // If user has a pushToken, you would call FCM/OneSignal here
            const user = await User.findById(recipientId).select('pushToken notificationsEnabled');
            if (user?.pushToken && user.notificationsEnabled) {
                // TODO: Call FCM Service
                // logger.info(`Actual Push Notification would be sent to token: ${user.pushToken}`);
            }

            return notification;
        } catch (error: any) {
            logger.error(`Error sending notification: ${error.message}`);
            return null;
        }
    }
}

export default new NotificationService();
