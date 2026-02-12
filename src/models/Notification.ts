import mongoose, { Document, Schema } from 'mongoose';

export interface INotification extends Document {
    recipient: mongoose.Types.ObjectId;
    sender?: mongoose.Types.ObjectId;
    type: 'membership_approved' | 'membership_expired' | 'clock_in' | 'clock_out' | 'system' | 'reminder' | 'announcement' | 'new_member' | 'membership_request' | 'expiry_warning' | 'inactivity_reminder';
    title: string;
    message: string;
    data?: any;
    isRead: boolean;
    createdAt: Date;
}

const NotificationSchema = new Schema<INotification>({
    recipient: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    sender: {
        type: Schema.Types.ObjectId,
        ref: 'User'
    },
    type: {
        type: String,
        required: true,
        enum: ['membership_approved', 'membership_expired', 'clock_in', 'clock_out', 'system', 'reminder', 'announcement', 'new_member', 'membership_request', 'expiry_warning', 'inactivity_reminder']
    },
    title: {
        type: String,
        required: true
    },
    message: {
        type: String,
        required: true
    },
    data: {
        type: Schema.Types.Mixed
    },
    isRead: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

export default mongoose.model<INotification>('Notification', NotificationSchema);
