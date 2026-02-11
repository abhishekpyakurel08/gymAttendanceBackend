import express from 'express';
import {
    getNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    sendTargetedNotification,
    broadcastNotification,
    sendToSelectedMembers
} from '../controllers/notificationController';
import { protect, authorize } from '../middleware/auth';


const router = express.Router();

// All routes are protected
router.use(protect);

router.route('/')
    .get(getNotifications);

router.put('/read-all', markAllAsRead);

router.route('/:id')
    .delete(deleteNotification);

router.put('/:id/read', markAsRead);

// Admin Only Routes
router.post('/targeted', authorize('admin', 'manager'), sendTargetedNotification);
router.post('/broadcast', authorize('admin', 'manager'), broadcastNotification);
router.post('/selected', authorize('admin', 'manager'), sendToSelectedMembers);

export default router;


