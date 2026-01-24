import mongoose, { Document, Schema } from 'mongoose';

export interface ITransaction extends Document {
    userId: mongoose.Types.ObjectId;
    type: 'subscription' | 'registration' | 'other';
    amount: number;
    method: 'cash' | 'online';
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
        required: true
    },
    type: {
        type: String,
        enum: ['subscription', 'registration', 'other'],
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    method: {
        type: String,
        enum: ['cash', 'online'],
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
