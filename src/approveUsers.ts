import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import User from './models/User';

dotenv.config();

const approveAll = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/shankmul_gym_attendance');
        console.log('Connected to MongoDB');

        const result = await User.updateMany(
            { 'membership.status': 'pending' },
            {
                $set: {
                    'membership.status': 'active',
                    'membership.startDate': new Date(),
                    'membership.expiryDate': new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
                }
            }
        );

        console.log(`Success! Approved ${result.modifiedCount} pending memberships.`);
        process.exit(0);
    } catch (error) {
        console.error('Error approving users:', error);
        process.exit(1);
    }
};

approveAll();
