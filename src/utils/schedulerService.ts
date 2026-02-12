import cron from 'node-cron';
import moment from 'moment-timezone';
import User from '../models/User';
import Attendance from '../models/Attendance';
import notificationService from './notificationService';
import logger from './logger';

const TIMEZONE = 'Asia/Kathmandu';

class SchedulerService {
    /**
     * Send expiry warnings to users whose membership expires in 3 days
     */
    async sendExpiryWarnings() {
        try {
            const now = moment().tz(TIMEZONE);
            const threeDaysLater = now.clone().add(3, 'days').endOf('day').toDate();
            const twoDaysLater = now.clone().add(2, 'days').startOf('day').toDate();

            const expiringUsers = await User.find({
                'membership.status': 'active',
                'membership.expiryDate': {
                    $gte: twoDaysLater,
                    $lte: threeDaysLater
                },
                isActive: true
            });

            logger.info(`Found ${expiringUsers.length} users with expiring memberships`);

            for (const user of expiringUsers) {
                const daysLeft = moment(user.membership?.expiryDate).diff(now, 'days');
                await notificationService.sendNotification({
                    recipientId: user._id.toString(),
                    type: 'expiry_warning',
                    title: '⚠️ Membership Expiring Soon!',
                    message: `Your membership expires in ${daysLeft} days. Renew now to continue your fitness journey!`,
                    data: { type: 'expiry_warning', daysLeft }
                });
            }

            logger.info(`✅ Sent expiry warnings to ${expiringUsers.length} users`);
        } catch (error: any) {
            logger.error('Error sending expiry warnings:', error.message);
        }
    }

    /**
     * Send inactivity reminders to users who haven't visited for 3 days
     */
    async sendInactivityReminders() {
        try {
            const now = moment().tz(TIMEZONE);
            const threeDaysAgo = now.clone().subtract(3, 'days').startOf('day').toDate();

            // Get all active members
            const activeUsers = await User.find({
                'membership.status': 'active',
                isActive: true,
                role: 'user'
            });

            let remindersSent = 0;

            for (const user of activeUsers) {
                // Check their last attendance
                const lastAttendance = await Attendance.findOne({
                    userId: user._id
                }).sort({ date: -1 });

                // If no attendance or last attendance was 3+ days ago
                if (!lastAttendance || moment(lastAttendance.date).isBefore(threeDaysAgo)) {
                    await notificationService.sendNotification({
                        recipientId: user._id.toString(),
                        type: 'inactivity_reminder',
                        title: '💪 We Miss You!',
                        message: 'It\'s been 3 days since your last visit. Get back on track today!',
                        data: { type: 'inactivity_reminder' }
                    });
                    remindersSent++;
                }
            }

            logger.info('✅ Sent inactivity reminders to ${remindersSent} users');
        } catch (error: any) {
            logger.error('Error sending inactivity reminders:', error);
        }
    }

    /**
     * Expire memberships that have passed their valid date
     */
    async expireMemberships() {
        try {
            const now = moment().tz(TIMEZONE).startOf('day').toDate();

            // Find memberships that expired YESTERDAY or before and are still marked active
            const expiredUsers = await User.find({
                'membership.status': 'active',
                'membership.expiryDate': { $lt: now }
            });

            logger.info(`Found ${expiredUsers.length} users with expired memberships to process`);

            for (const user of expiredUsers) {
                if (user.membership) {
                    user.membership.status = 'expired';
                    await user.save();

                    // Send notification
                    await notificationService.sendNotification({
                        recipientId: user._id.toString(),
                        type: 'membership_expired',
                        title: 'Membership Expired ⚠️',
                        message: 'Your gym membership has expired. Please renew to continue access.',
                        data: { type: 'expired' }
                    });

                    logger.info(`Markdown user ${user.email} as expired.`);
                }
            }

        } catch (error: any) {
            logger.error('Error processing expired memberships:', error);
        }
    }

    /**
     * Initialize all scheduled jobs
     */
    init() {
        // Run expiry warnings daily at 9 AM
        cron.schedule('0 9 * * *', async () => {
            logger.info('⏰ Running scheduled expiry warnings...');
            await this.sendExpiryWarnings();
        }, {
            timezone: TIMEZONE
        });

        // Run inactivity reminders daily at 6 PM
        cron.schedule('0 18 * * *', async () => {
            logger.info('⏰ Running scheduled inactivity reminders...');
            await this.sendInactivityReminders();
        }, {
            timezone: TIMEZONE
        });

        // Run auto-expiration daily at Midnight (00:01)
        cron.schedule('1 0 * * *', async () => {
            logger.info('⏰ Running scheduled auto-expiration...');
            await this.expireMemberships();
        }, {
            timezone: TIMEZONE
        });

        logger.info('📅 Scheduler service initialized');
        logger.info('  - Expiry warnings: Daily at 9:00 AM');
        logger.info('  - Inactivity reminders: Daily at 6:00 PM');
        logger.info('  - Auto Expiration: Daily at 12:01 AM');
    }
}

export default new SchedulerService();
