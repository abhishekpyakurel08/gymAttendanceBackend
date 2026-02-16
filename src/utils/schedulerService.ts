import cron from 'node-cron';
import moment from 'moment-timezone';
import User from '../models/User';
import Attendance from '../models/Attendance';
import GymSettings, { IGymSettings } from '../models/GymSettings';
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
            const settings = await GymSettings.findOne();
            const currentTz = settings?.timezone || TIMEZONE;
            const now = moment().tz(currentTz);

            // Define targeted days
            const checkDays = [
                { days: 3, title: '⚠️ Membership Expiring Soon!', urgency: 'low' },
                { days: 1, title: '🚨 Last Chance: Membership Expiring!', urgency: 'critical' }
            ];

            let totalNotified = 0;

            for (const target of checkDays) {
                const startOfTarget = now.clone().add(target.days, 'days').startOf('day').toDate();
                const endOfTarget = now.clone().add(target.days, 'days').endOf('day').toDate();

                const expiringUsers = await User.find({
                    'membership.status': 'active',
                    'membership.expiryDate': {
                        $gte: startOfTarget,
                        $lte: endOfTarget
                    },
                    isActive: true,
                    notificationsEnabled: true
                });

                if (expiringUsers.length === 0) continue;

                for (const user of expiringUsers) {
                    await notificationService.sendNotification({
                        recipientId: user._id.toString(),
                        type: 'expiry_warning',
                        title: target.title,
                        message: target.days === 1
                            ? `Your membership expires tomorrow! Renew today to avoid losing access to the facility. 💪`
                            : `Your membership expires in 3 days. Renew now to continue your fitness journey!`,
                        data: { type: 'expiry_warning', daysLeft: target.days, urgency: target.urgency }
                    });
                }

                // Notify admins about the batches
                const admins = await User.find({ role: { $in: ['admin', 'manager', 'reception'] }, isActive: true });
                const memberNames = expiringUsers.map(u => `${u.firstName} ${u.lastName}`).join(', ');

                for (const admin of admins) {
                    await notificationService.sendNotification({
                        recipientId: admin._id.toString(),
                        type: 'expiry_warning',
                        title: `📋 ${expiringUsers.length} Member(s) expiring in ${target.days} day(s)`,
                        message: `The following members expire in ${target.days} day(s): ${memberNames}.`,
                        data: { type: 'admin_expiry_alert', count: expiringUsers.length, days: target.days }
                    });
                }

                totalNotified += expiringUsers.length;
            }

            logger.info(`✅ Expiry warning cycle complete. Notified ${totalNotified} users.`);
        } catch (error: any) {
            logger.error('Error sending expiry warnings:', error.message);
        }
    }

    /**
     * Send inactivity reminders to users who haven't visited for 3 days
     */
    async sendInactivityReminders() {
        try {
            const settings = await GymSettings.findOne();
            const currentTz = settings?.timezone || TIMEZONE;
            const now = moment().tz(currentTz);
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
            const settings = await GymSettings.findOne();
            const currentTz = settings?.timezone || TIMEZONE;
            const now = moment().tz(currentTz);
            const today = now.clone().startOf('day').toDate();

            // Find memberships that expired YESTERDAY or before and are still marked active
            const expiredUsers = await User.find({
                'membership.status': 'active',
                'membership.expiryDate': { $lt: today }
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

                // 🔄 BROADCAST TO DASHBOARDS
                notificationService.sendAdminNotification('stats_updated', { type: 'membership' });
                notificationService.sendAdminNotification('membership_approved', { type: 'auto_expire', count: expiredUsers.length });
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
            const settings = await GymSettings.findOne();
            const currentTz = settings?.timezone || TIMEZONE;
            const now = moment().tz(currentTz);
            const dayName = now.format('dddd').toLowerCase() as keyof IGymSettings['operatingHours'];

            // Check if gym is open today
            if (settings && settings.operatingHours && settings.operatingHours[dayName]) {
                if (!settings.operatingHours[dayName].isOpen) {
                    logger.info(`⏭️ Skipping morning greetings - ${dayName} (gym closed)`);
                    return;
                }
            } else if (now.day() === 6) { // Fallback for Saturday
                logger.info('⏭️ Skipping morning greetings - Saturday (Default closed day)');
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
            const settings = await GymSettings.findOne();
            const currentTz = settings?.timezone || TIMEZONE;
            const now = moment().tz(currentTz);
            const dayName = now.format('dddd').toLowerCase() as keyof IGymSettings['operatingHours'];
            const currentHour = now.hour();

            // Check if gym is open today
            if (settings && settings.operatingHours && settings.operatingHours[dayName]) {
                const todayHours = settings.operatingHours[dayName];
                if (!todayHours.isOpen) return;

                // Skip hours outside gym operating hours
                const openHour = parseInt(todayHours.openTime.split(':')[0]);
                const closeHour = parseInt(todayHours.closeTime.split(':')[0]);
                if (currentHour < openHour || currentHour >= closeHour) return;
            } else {
                // Fallback logic
                if (now.day() === 6) return;
                if (currentHour < 5 || currentHour >= 20) return;
            }

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
            const today = now.clone().startOf('day').toDate();

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
            const settings = await GymSettings.findOne();
            const currentTz = settings?.timezone || TIMEZONE;
            const now = moment().tz(currentTz);
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
            const settings = await GymSettings.findOne();
            const currentTz = settings?.timezone || TIMEZONE;
            const now = moment().tz(currentTz);
            const dayName = now.format('dddd').toLowerCase() as keyof IGymSettings['operatingHours'];

            // Check if gym is open today
            if (settings && settings.operatingHours && settings.operatingHours[dayName]) {
                if (!settings.operatingHours[dayName].isOpen) return;
            } else if (now.day() === 6) {
                return;
            }

            const today = now.clone().startOf('day').toDate();
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
    async init() {
        // Fetch current settings for timezone
        let settings;
        try {
            settings = await GymSettings.findOne();
        } catch (error) {
            logger.warn('Could not fetch gym settings for scheduler init, using default timezone');
        }

        const currentTz = settings?.timezone || TIMEZONE;
        logger.info(`📅 Initializing Scheduler with timezone: ${currentTz}`);

        // 🌅 Morning Motivational Greetings - Daily at 6:00 AM
        cron.schedule('0 6 * * *', async () => {
            logger.info('⏰ Running scheduled morning greetings...');
            await this.sendMorningGreetings();
        }, {
            timezone: currentTz
        });

        // ⏰ Workout Time Reminders - Every hour (Internal logic filters by gym hours)
        cron.schedule('0 * * * *', async () => {
            logger.info('⏰ Running scheduled workout reminders...');
            await this.sendWorkoutReminders();
        }, {
            timezone: currentTz
        });

        // ⚠️ Expiry warnings - Daily at 9:00 AM
        cron.schedule('0 9 * * *', async () => {
            logger.info('⏰ Running scheduled expiry warnings...');
            await this.sendExpiryWarnings();
        }, {
            timezone: currentTz
        });

        // 🌆 Evening Reminders for those who haven't visited - Daily at 4:00 PM
        cron.schedule('0 16 * * *', async () => {
            logger.info('⏰ Running scheduled evening reminders...');
            await this.sendEveningReminders();
        }, {
            timezone: currentTz
        });

        // 💪 Inactivity reminders - Daily at 6:00 PM
        cron.schedule('0 18 * * *', async () => {
            logger.info('⏰ Running scheduled inactivity reminders...');
            await this.sendInactivityReminders();
        }, {
            timezone: currentTz
        });

        // 🕛 Auto-expiration - Daily at 12:01 AM
        cron.schedule('1 0 * * *', async () => {
            logger.info('⏰ Running scheduled auto-expiration...');
            await this.expireMemberships();
        }, {
            timezone: currentTz
        });

        // 📊 Weekly Progress Summary - Every Sunday at 10:00 AM
        cron.schedule('0 10 * * 0', async () => {
            logger.info('⏰ Running weekly progress summaries...');
            await this.sendWeeklyProgress();
        }, {
            timezone: currentTz
        });

        // 🧟 Auto Clock-out Zombie Sessions - Every hour at minute 5
        // This handles cases where users leave without clocking out and app is closed
        cron.schedule('5 * * * *', async () => {
            logger.info('⏰ Running scheduled auto clock-out for zombie sessions...');
            await this.autoClockOutZombieSessions();
        }, {
            timezone: currentTz
        });

        logger.info('📅 Scheduler service initialized with AUTO NOTIFICATIONS');
        logger.info('  - 🌅 Morning greetings:    Daily at 6:00 AM');
        logger.info('  - ⏰ Workout reminders:    Every hour (5AM-7PM)');
        logger.info('  - ⚠️ Expiry warnings:      Daily at 9:00 AM');
        logger.info('  - 🌆 Evening reminders:    Daily at 4:00 PM');
        logger.info('  - 💪 Inactivity reminders: Daily at 6:00 PM');
        logger.info('  - 🕛 Auto Expiration:      Daily at 12:01 AM');
        logger.info('  - 📊 Weekly Progress:      Sunday at 10:00 AM');
        logger.info('  - 🧟 Zombie Clock-out:     Every hour at :05');
    }

    /**
     * Finds and clocks out any user who has been clocked in for more than 4 hours
     * but hasn't clocked out yet. This ensures "Live Presence" remains accurate.
     */
    async autoClockOutZombieSessions() {
        try {
            const settings = await GymSettings.findOne();
            const currentTz = settings?.timezone || TIMEZONE;
            const now = moment().tz(currentTz);

            // Sessions older than 4 hours are considered zombie sessions
            const cutoff = now.clone().subtract(4, 'hours').toDate();

            const zombieSessions = await Attendance.find({
                clockOut: { $exists: false },
                clockIn: { $lt: cutoff }
            }).populate('userId');

            if (zombieSessions.length === 0) return;

            logger.info(`🔍 Found ${zombieSessions.length} zombie sessions to auto clock-out.`);

            for (const session of zombieSessions) {
                // Set clock-out to 4 hours after clock-in (or whichever came first)
                const autoClockOutTime = moment(session.clockIn).add(4, 'hours').toDate();
                session.clockOut = autoClockOutTime;

                // Add a note or flag if needed, but for now just save
                await session.save();

                const user = session.userId as any;
                if (user) {
                    await notificationService.sendNotification({
                        recipientId: user._id.toString(),
                        type: 'system',
                        title: '⏰ Auto Clock-Out',
                        message: `Your gym session was automatically ended after 4 hours of inactivity.`,
                        data: { type: 'auto_clock_out', attendanceId: session._id }
                    });
                }
            }

            // Notify admins that cleanup happened
            notificationService.sendAdminNotification('stats_updated', { type: 'attendance' });

            logger.info(`✅ Successfully auto clocked-out ${zombieSessions.length} zombie sessions.`);
        } catch (error: any) {
            logger.error('Error in autoClockOutZombieSessions:', error.message);
        }
    }
}

export default new SchedulerService();
