import cron from 'node-cron';
import moment from 'moment-timezone';
import User from '../models/User';
import Attendance from '../models/Attendance';
import notificationService from './notificationService';
import logger from './logger';

const TIMEZONE = 'Asia/Kathmandu';

// Motivational messages pool for daily greetings
const MORNING_MESSAGES = [
    { title: '🌅 Rise & Shine!', message: 'A new day, a new opportunity to be better than yesterday. Hit the gym today!' },
    { title: '☀️ Good Morning, Champion!', message: 'Your muscles are waiting for you. Let\'s make some gains today!' },
    { title: '💪 Morning Power!', message: 'The early bird gets the gains! Start your day strong at the gym.' },
    { title: '🔥 Fuel Your Day!', message: 'Great things never came from comfort zones. Time to train!' },
    { title: '🏆 Champions Train Today!', message: 'Today\'s workout is tomorrow\'s strength. Don\'t skip!' },
];

const EVENING_MESSAGES = [
    { title: '🌆 Evening Warrior!', message: 'End your day strong! An evening workout is the perfect stress relief.' },
    { title: '💪 Post-Work Pump!', message: 'Shake off the day\'s stress with a powerful gym session tonight!' },
    { title: '🏋️ Evening Session Time!', message: 'The gym is calling! Perfect time for an evening workout.' },
    { title: '🌙 Night Grind!', message: 'While others rest, warriors train. Time to hit the gym!' },
];

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

            // Also notify admins about expiring memberships
            if (expiringUsers.length > 0) {
                const admins = await User.find({ role: { $in: ['admin', 'manager'] }, isActive: true });
                const memberNames = expiringUsers.map(u => `${u.firstName} ${u.lastName}`).join(', ');
                for (const admin of admins) {
                    await notificationService.sendNotification({
                        recipientId: admin._id.toString(),
                        type: 'expiry_warning',
                        title: `⚠️ ${expiringUsers.length} Membership(s) Expiring`,
                        message: `The following members' memberships are expiring in 3 days: ${memberNames}. Please follow up for renewal.`,
                        data: { type: 'admin_expiry_alert', count: expiringUsers.length, userIds: expiringUsers.map(u => u._id) }
                    });
                }
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
                    const daysSinceLastVisit = lastAttendance
                        ? now.diff(moment(lastAttendance.date), 'days')
                        : '∞';

                    await notificationService.sendNotification({
                        recipientId: user._id.toString(),
                        type: 'inactivity_reminder',
                        title: '💪 We Miss You!',
                        message: `It's been ${daysSinceLastVisit} days since your last visit. Get back on track today! Your goals are waiting! 🏋️`,
                        data: { type: 'inactivity_reminder', daysSinceLastVisit }
                    });
                    remindersSent++;
                }
            }

            logger.info(`✅ Sent inactivity reminders to ${remindersSent} users`);
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

                    // Send notification to the member
                    await notificationService.sendNotification({
                        recipientId: user._id.toString(),
                        type: 'membership_expired',
                        title: 'Membership Expired ⚠️',
                        message: 'Your gym membership has expired. Please renew to continue access. We\'d love to see you back! 💪',
                        data: { type: 'expired' }
                    });

                    logger.info(`Marked user ${user.email} as expired.`);
                }
            }

            // Notify admins about newly expired memberships
            if (expiredUsers.length > 0) {
                const admins = await User.find({ role: { $in: ['admin', 'manager'] }, isActive: true });
                for (const admin of admins) {
                    await notificationService.sendNotification({
                        recipientId: admin._id.toString(),
                        type: 'membership_expired',
                        title: `📋 ${expiredUsers.length} Membership(s) Expired Today`,
                        message: `${expiredUsers.map(u => `${u.firstName} ${u.lastName}`).join(', ')} - membership(s) have been auto-expired. Follow up for renewal.`,
                        data: { type: 'admin_expired_alert', count: expiredUsers.length }
                    });
                }
            }

        } catch (error: any) {
            logger.error('Error processing expired memberships:', error);
        }
    }

    /**
     * 🆕 Send Morning Motivational Greetings to all active members
     * Runs daily at 6:00 AM
     */
    async sendMorningGreetings() {
        try {
            const now = moment().tz(TIMEZONE);
            const dayOfWeek = now.day();

            // Skip Saturday (gym is closed)
            if (dayOfWeek === 6) {
                logger.info('⏭️ Skipping morning greetings - Saturday (gym closed)');
                return;
            }

            const randomMessage = MORNING_MESSAGES[Math.floor(Math.random() * MORNING_MESSAGES.length)];

            const activeUsers = await User.find({
                'membership.status': 'active',
                isActive: true,
                role: 'user',
                notificationsEnabled: true
            });

            if (activeUsers.length === 0) {
                logger.info('No active users to send morning greetings to');
                return;
            }

            const userIds = activeUsers.map(u => u._id.toString());

            await notificationService.sendMultipleNotifications({
                userIds,
                type: 'auto_greeting',
                title: randomMessage.title,
                message: randomMessage.message,
                data: { type: 'auto_greeting', period: 'morning', date: now.format('YYYY-MM-DD') }
            });

            logger.info(`✅ Sent morning greetings to ${activeUsers.length} active members`);
        } catch (error: any) {
            logger.error('Error sending morning greetings:', error.message);
        }
    }

    /**
     * 🆕 Send Workout Time Reminders based on user's preferred workout schedule
     * Runs every hour to check for users whose preferred workout time is coming up
     */
    async sendWorkoutReminders() {
        try {
            const now = moment().tz(TIMEZONE);
            const dayOfWeek = now.day();
            const currentHour = now.hour();

            // Skip Saturday
            if (dayOfWeek === 6) return;

            // Skip hours outside gym operating hours (5 AM - 8 PM)
            if (currentHour < 5 || currentHour >= 20) return;

            // Find users whose preferred workout start is within the next hour
            const targetHour = String(currentHour + 1).padStart(2, '0');
            const targetTimePattern = `${targetHour}:`;

            const usersToNotify = await User.find({
                'membership.status': 'active',
                isActive: true,
                role: 'user',
                notificationsEnabled: true,
                preferredWorkoutStart: { $regex: `^${targetHour}:` }
            });

            if (usersToNotify.length === 0) return;

            // Check if they already visited today - no need to remind
            const today = moment().tz(TIMEZONE).startOf('day').toDate();

            for (const user of usersToNotify) {
                const alreadyVisited = await Attendance.findOne({
                    userId: user._id,
                    date: today
                });

                if (!alreadyVisited) {
                    await notificationService.sendNotification({
                        recipientId: user._id.toString(),
                        type: 'workout_reminder',
                        title: '⏰ Workout Time Coming Up!',
                        message: `Your scheduled workout starts at ${user.preferredWorkoutStart}. Get ready to hit the gym! 🏋️💪`,
                        data: {
                            type: 'workout_reminder',
                            scheduledTime: user.preferredWorkoutStart,
                            date: now.format('YYYY-MM-DD')
                        }
                    });
                }
            }

            logger.info(`✅ Sent workout reminders to ${usersToNotify.length} users for ${targetHour}:00 slot`);
        } catch (error: any) {
            logger.error('Error sending workout reminders:', error.message);
        }
    }

    /**
     * 🆕 Send Weekly Progress Summary every Sunday
     */
    async sendWeeklyProgress() {
        try {
            const now = moment().tz(TIMEZONE);
            const weekStart = now.clone().subtract(7, 'days').startOf('day').toDate();
            const weekEnd = now.clone().startOf('day').toDate();

            const activeUsers = await User.find({
                'membership.status': 'active',
                isActive: true,
                role: 'user',
                notificationsEnabled: true
            });

            for (const user of activeUsers) {
                const weeklyAttendance = await Attendance.countDocuments({
                    userId: user._id,
                    date: { $gte: weekStart, $lt: weekEnd }
                });

                let progressMsg = '';
                let progressTitle = '';

                if (weeklyAttendance >= 6) {
                    progressTitle = '🏆 Outstanding Week!';
                    progressMsg = `Incredible! You visited the gym ${weeklyAttendance} times this week! You're a true champion! Keep up this amazing streak! 🔥`;
                } else if (weeklyAttendance >= 4) {
                    progressTitle = '💪 Great Week!';
                    progressMsg = `Solid performance! ${weeklyAttendance} gym sessions this week. You're building consistency! Push for even more next week! 🎯`;
                } else if (weeklyAttendance >= 2) {
                    progressTitle = '📊 Weekly Check-in';
                    progressMsg = `You made it ${weeklyAttendance} times this week. Good start! Try to add one more session next week. Small steps = big results! 🌟`;
                } else if (weeklyAttendance >= 1) {
                    progressTitle = '🔔 Weekly Reminder';
                    progressMsg = `Only ${weeklyAttendance} visit(s) this week. We miss you! Aim for at least 3 sessions next week. You can do it! 💪`;
                } else {
                    progressTitle = '😢 We Missed You This Week';
                    progressMsg = 'Zero gym visits this week! Don\'t worry - every new week is a fresh start. Let\'s make next week count! 🚀';
                }

                await notificationService.sendNotification({
                    recipientId: user._id.toString(),
                    type: 'system',
                    title: progressTitle,
                    message: progressMsg,
                    data: { type: 'weekly_progress', weeklyVisits: weeklyAttendance, weekStart: weekStart, weekEnd: weekEnd }
                });
            }

            logger.info(`✅ Sent weekly progress summaries to ${activeUsers.length} users`);
        } catch (error: any) {
            logger.error('Error sending weekly progress:', error.message);
        }
    }

    /**
     * 🆕 Send Evening Reminders to users who haven't visited today
     */
    async sendEveningReminders() {
        try {
            const now = moment().tz(TIMEZONE);
            const dayOfWeek = now.day();

            // Skip Saturday
            if (dayOfWeek === 6) return;

            const today = moment().tz(TIMEZONE).startOf('day').toDate();
            const randomMessage = EVENING_MESSAGES[Math.floor(Math.random() * EVENING_MESSAGES.length)];

            const activeUsers = await User.find({
                'membership.status': 'active',
                isActive: true,
                role: 'user',
                notificationsEnabled: true
            });

            let remindersSent = 0;

            for (const user of activeUsers) {
                const alreadyVisited = await Attendance.findOne({
                    userId: user._id,
                    date: today
                });

                if (!alreadyVisited) {
                    await notificationService.sendNotification({
                        recipientId: user._id.toString(),
                        type: 'auto_greeting',
                        title: randomMessage.title,
                        message: randomMessage.message,
                        data: { type: 'evening_reminder', date: now.format('YYYY-MM-DD') }
                    });
                    remindersSent++;
                }
            }

            logger.info(`✅ Sent evening reminders to ${remindersSent} users who haven't visited today`);
        } catch (error: any) {
            logger.error('Error sending evening reminders:', error.message);
        }
    }

    /**
     * Initialize all scheduled jobs
     */
    init() {
        // 🌅 Morning Motivational Greetings - Daily at 6:00 AM
        cron.schedule('0 6 * * *', async () => {
            logger.info('⏰ Running scheduled morning greetings...');
            await this.sendMorningGreetings();
        }, {
            timezone: TIMEZONE
        });

        // ⏰ Workout Time Reminders - Every hour during gym hours (5 AM - 8 PM)
        cron.schedule('0 5-19 * * *', async () => {
            logger.info('⏰ Running scheduled workout reminders...');
            await this.sendWorkoutReminders();
        }, {
            timezone: TIMEZONE
        });

        // ⚠️ Expiry warnings - Daily at 9:00 AM
        cron.schedule('0 9 * * *', async () => {
            logger.info('⏰ Running scheduled expiry warnings...');
            await this.sendExpiryWarnings();
        }, {
            timezone: TIMEZONE
        });

        // 🌆 Evening Reminders for those who haven't visited - Daily at 4:00 PM
        cron.schedule('0 16 * * *', async () => {
            logger.info('⏰ Running scheduled evening reminders...');
            await this.sendEveningReminders();
        }, {
            timezone: TIMEZONE
        });

        // 💪 Inactivity reminders - Daily at 6:00 PM
        cron.schedule('0 18 * * *', async () => {
            logger.info('⏰ Running scheduled inactivity reminders...');
            await this.sendInactivityReminders();
        }, {
            timezone: TIMEZONE
        });

        // 🕛 Auto-expiration - Daily at 12:01 AM
        cron.schedule('1 0 * * *', async () => {
            logger.info('⏰ Running scheduled auto-expiration...');
            await this.expireMemberships();
        }, {
            timezone: TIMEZONE
        });

        // 📊 Weekly Progress Summary - Every Sunday at 10:00 AM
        cron.schedule('0 10 * * 0', async () => {
            logger.info('⏰ Running weekly progress summaries...');
            await this.sendWeeklyProgress();
        }, {
            timezone: TIMEZONE
        });

        logger.info('📅 Scheduler service initialized with AUTO NOTIFICATIONS');
        logger.info('  - 🌅 Morning greetings:    Daily at 6:00 AM');
        logger.info('  - ⏰ Workout reminders:    Every hour (5AM-7PM)');
        logger.info('  - ⚠️ Expiry warnings:      Daily at 9:00 AM');
        logger.info('  - 🌆 Evening reminders:    Daily at 4:00 PM');
        logger.info('  - 💪 Inactivity reminders: Daily at 6:00 PM');
        logger.info('  - 🕛 Auto Expiration:      Daily at 12:01 AM');
        logger.info('  - 📊 Weekly Progress:      Sunday at 10:00 AM');
    }
}

export default new SchedulerService();
