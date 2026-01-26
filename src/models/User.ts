import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IUser extends Document {
    employeeId: string;
    email: string;
    phoneNumber?: string;
    password: string;
    firstName: string;
    lastName: string;
    department: string;
    role: 'admin' | 'manager' | 'user';
    isActive: boolean;
    age?: number;
    gender?: 'male' | 'female' | 'other';
    profileImage?: string;
    membership?: {
        plan: '1-month' | '3-month' | '6-month' | '1-year' | 'none';
        startDate: Date;
        expiryDate: Date;
        status: 'active' | 'expired' | 'pending';
        monthlyDayCount: number; // For the 26-day rule tracking
        lastResetDate: Date;      // To track when the 26-day count was last reset (monthly)
    };
    shift?: 'morning' | 'evening' | 'both';
    createdAt: Date;
    updatedAt: Date;
    pushToken?: string;
    notificationsEnabled: boolean;
    salary?: number;
    paymentFrequency?: 'monthly' | 'bimonthly' | 'weekly';
    preferredWorkoutStart?: string; // e.g. "18:30"
    preferredWorkoutEnd?: string;   // e.g. "20:00"
    comparePassword(candidatePassword: string): Promise<boolean>;
}

const UserSchema = new Schema<IUser>({
    employeeId: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    phoneNumber: {
        type: String,
        trim: true,
        default: ''
    },
    password: {
        type: String,
        required: true,
        minlength: 6
    },
    firstName: {
        type: String,
        required: true,
        trim: true
    },
    lastName: {
        type: String,
        required: true,
        trim: true
    },
    department: {
        type: String,
        required: true,
        enum: ['Management', 'Engineering', 'Sales', 'HR', 'Marketing', 'Operations'],
        default: 'Operations'
    },
    role: {
        type: String,
        enum: ['admin', 'manager', 'user'],
        default: 'user'
    },
    isActive: {
        type: Boolean,
        default: true
    },
    age: {
        type: Number,
        min: 0
    },
    gender: {
        type: String,
        enum: ['male', 'female', 'other']
    },
    profileImage: {
        type: String
    },
    membership: {
        plan: {
            type: String,
            enum: ['1-month', '3-month', '6-month', '1-year', 'none'],
            default: 'none'
        },
        startDate: Date,
        expiryDate: Date,
        status: {
            type: String,
            enum: ['active', 'expired', 'pending'],
            default: 'pending'
        },
        monthlyDayCount: {
            type: Number,
            default: 0
        },
        lastResetDate: {
            type: Date,
            default: Date.now
        }
    },
    pushToken: {
        type: String,
        trim: true
    },
    notificationsEnabled: {
        type: Boolean,
        default: true
    },
    salary: {
        type: Number,
        default: 0
    },
    paymentFrequency: {
        type: String,
        enum: ['monthly', 'bimonthly', 'weekly'],
        default: 'monthly'
    },
    shift: {
        type: String,
        enum: ['morning', 'evening', 'both'],
        default: 'both'
    },
    preferredWorkoutStart: {
        type: String,
        default: '06:00'
    },
    preferredWorkoutEnd: {
        type: String,
        default: '08:00'
    }
}, {
    timestamps: true
});

// Hash password before saving
UserSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();

    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error: any) {
        next(error);
    }
});

// Compare password method
UserSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
    return bcrypt.compare(candidatePassword, this.password);
};

export default mongoose.model<IUser>('User', UserSchema);
