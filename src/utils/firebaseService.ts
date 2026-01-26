import * as admin from 'firebase-admin';
import logger from './logger';

class FirebaseService {
    private isInitialized = false;

    init() {
        try {
            if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
                admin.initializeApp({
                    credential: admin.credential.cert({
                        projectId: process.env.FIREBASE_PROJECT_ID,
                        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
                    }),
                });
                this.isInitialized = true;
                logger.info('🔥 Firebase Admin initialized successfully');
            } else {
                logger.warn('⚠️ Firebase credentials missing. Push notifications will be disabled.');
            }
        } catch (error: any) {
            logger.error(`❌ Firebase initialization error: ${error.message}`);
        }
    }

    async sendPushNotification(token: string, title: string, body: string, data?: any) {
        if (!this.isInitialized) {
            logger.warn('Cannot send push notification: Firebase not initialized');
            return null;
        }

        try {
            const message = {
                notification: {
                    title,
                    body,
                },
                data: data ? { ...data, click_action: 'FLUTTER_NOTIFICATION_CLICK' } : undefined,
                token,
            };

            const response = await admin.messaging().send(message);
            logger.info(`Successfully sent push notification: ${response}`);
            return response;
        } catch (error: any) {
            logger.error(`Error sending push notification: ${error.message}`);
            return null;
        }
    }

    async sendMulticastNotification(tokens: string[], title: string, body: string, data?: any) {
        if (!this.isInitialized || tokens.length === 0) return null;

        try {
            const message = {
                notification: { title, body },
                data,
                tokens,
            };

            const response = await admin.messaging().sendEachForMulticast(message);
            logger.info(`Successfully sent multicast notifications: ${response.successCount} success, ${response.failureCount} failure`);
            return response;
        } catch (error: any) {
            logger.error(`Error sending multicast notification: ${error.message}`);
            return null;
        }
    }
}

export default new FirebaseService();
