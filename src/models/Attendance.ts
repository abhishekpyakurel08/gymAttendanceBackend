import mongoose, { Document, Schema } from 'mongoose';

export interface IAttendance extends Document {
    userId: mongoose.Types.ObjectId;
    date: Date;
    clockIn: Date;
    clockOut?: Date;
    status: 'on-time' | 'late' | 'absent' | 'half-day';
    location: {
        latitude: number;
        longitude: number;
        address?: string;
    };
    clockOutLocation?: {
        latitude: number;
        longitude: number;
        address?: string;
    };
    totalHours?: number;
    createdAt: Date;
    updatedAt: Date;
}

const AttendanceSchema = new Schema<IAttendance>({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    date: {
        type: Date,
        required: true
    },
    clockIn: {
        type: Date,
        required: true
    },
    clockOut: {
        type: Date
    },
    status: {
        type: String,
        enum: ['on-time', 'late', 'absent', 'half-day'],
        default: 'on-time'
    },
    location: {
        latitude: {
            type: Number,
            required: true
        },
        longitude: {
            type: Number,
            required: true
        },
        address: String
    },
    clockOutLocation: {
        latitude: Number,
        longitude: Number,
        address: String
    },
    totalHours: {
        type: Number
    }
}, {
    timestamps: true
});

// Calculate total hours before saving
AttendanceSchema.pre('save', function (next) {
    if (this.clockIn && this.clockOut) {
        const diffMs = this.clockOut.getTime() - this.clockIn.getTime();
        this.totalHours = diffMs / (1000 * 60 * 60); // Convert to hours
    }
    next();
});

// Index for faster queries
AttendanceSchema.index({ userId: 1, date: -1 });

export default mongoose.model<IAttendance>('Attendance', AttendanceSchema);
