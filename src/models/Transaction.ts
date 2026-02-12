import mongoose, { Document, Schema } from 'mongoose';

export interface ITransaction extends Document {
    userId?: mongoose.Types.ObjectId;
    category: 'income' | 'expense';
    type: 'subscription' | 'registration' | 'salary' | 'rent' | 'electricity' | 'maintenance' | 'other';
    amount: number;
    method: 'cash' | 'online' | 'esewa' | 'khalti' | 'bank' | 'Cash' | 'eSewa' | 'Khalti' | 'Bank';

    plan?: string;
    description?: string;
    date: Date;
    createdAt: Date;
    updatedAt: Date;
}

const TransactionSchema = new Schema<ITransaction>({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: false
    },
    category: {
        type: String,
        enum: ['income', 'expense'],
        required: true,
        default: 'income'
    },
    type: {
        type: String,
        enum: ['subscription', 'registration', 'salary', 'rent', 'electricity', 'maintenance', 'other'],
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    method: {
        type: String,
        enum: ['cash', 'online', 'esewa', 'khalti', 'bank', 'Cash', 'eSewa', 'Khalti', 'Bank'],
        required: true
    },

    plan: {
        type: String
    },
    description: {
        type: String
    },
    date: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

export default mongoose.model<ITransaction>('Transaction', TransactionSchema);
