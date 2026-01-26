import express from 'express';
import {
    getNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    sendTargetedNotification
} from '../controllers/notificationController';
import { protect } from '../middleware/auth';

const router = express.Router();

// All routes are protected
router.use(protect);

router.route('/')
    .get(getNotifications);

router.put('/read-all', markAllAsRead);

router.route('/:id')
    .delete(deleteNotification);

router.put('/:id/read', markAsRead);
router.post('/targeted', sendTargetedNotification);

export default router;
