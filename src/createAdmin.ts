import mongoose from 'mongoose';
import dotenv from 'dotenv';
import connectDB from './config/database';
import User from './models/User';

dotenv.config();

const createAdmin = async () => {
    // Usage: npx ts-node src/createAdmin.ts <email> <password> [firstName] [employeeId]
    const email = process.argv[2];
    const password = process.argv[3];
    const firstName = process.argv[4] || 'Admin';
    const employeeId = process.argv[5] || 'ADMIN-' + Math.floor(1000 + Math.random() * 9000);

    if (!email || !password) {
        console.log('\x1b[33m%s\x1b[0m', '⚠️ Usage: npx ts-node src/createAdmin.ts <email> <password> [firstName] [employeeId]');
        process.exit(1);
    }

    try {
        console.log('🔗 Connecting to database...');
        await connectDB();

        console.log(`🔍 Checking if user ${email} exists...`);
        const exists = await User.findOne({ email });
        if (exists) {
            console.log('\x1b[31m%s\x1b[0m', `❌ User with email ${email} already exists.`);
            process.exit(1);
        }

        console.log('🏗️  Creating admin user...');
        const admin = await User.create({
            email,
            password,
            firstName,
            lastName: 'Master',
            employeeId,
            role: 'admin',
            isActive: true,
            department: 'Management',
            profileImage: `https://api.dicebear.com/9.x/avataaars/png?seed=${email}`
        });

        console.log('\x1b[32m%s\x1b[0m', '✅ Admin created successfully!');
        console.log('---------------------------');
        console.log(`📧 Email: ${admin.email}`);
        console.log(`🔑 Password: ${password}`);
        console.log(`🆔 Employee ID: ${admin.employeeId}`);
        console.log(`🎭 Role: ${admin.role}`);
        console.log('---------------------------');

        process.exit(0);
    } catch (error) {
        console.error('\x1b[31m%s\x1b[0m', '❌ Failed to create admin:', error);
        process.exit(1);
    }
};

createAdmin();
