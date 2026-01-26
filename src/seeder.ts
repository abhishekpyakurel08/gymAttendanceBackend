import mongoose from 'mongoose';
import dotenv from 'dotenv';
import connectDB from './config/database';
import User from './models/User';

dotenv.config();

const seedUsers = async () => {
    try {
        await connectDB();
        console.log('🌱 Connected to database...');

        // 1. Create Head Admin
        const adminEmail = 'suroj@gmail.com';
        const adminEmpId = 'ADMIN-001';
        // Aggressively delete potential conflicts
        await User.deleteOne({ $or: [{ email: adminEmail }, { employeeId: adminEmpId }] });
        console.log('🗑️  Existing admin cleared (if any)');

        await User.create({
            employeeId: adminEmpId,
            email: adminEmail,
            password: 'password123',
            firstName: 'Suroj',
            lastName: 'Admin',
            department: 'Management',
            role: 'admin',
            isActive: true,
            profileImage: `https://api.dicebear.com/9.x/avataaars/png?seed=${adminEmail}`
        });
        console.log('✅ Admin user recreated: suroj@gmail.com / password123');

        // 2. Create Manager
        const managerEmail = 'manager@gmail.com';
        const managerEmpId = 'MGR-001';
        const managerExists = await User.findOne({ $or: [{ email: managerEmail }, { employeeId: managerEmpId }] });

        if (!managerExists) {
            await User.create({
                employeeId: managerEmpId,
                email: managerEmail,
                password: 'password123',
                firstName: 'Gym',
                lastName: 'Manager',
                department: 'Operations',
                role: 'manager',
                isActive: true,
                profileImage: `https://api.dicebear.com/9.x/avataaars/png?seed=${managerEmail}`
            });
            console.log('✅ Manager user created: manager@gmail.com / password123');
        } else {
            console.log('ℹ️ Manager user already exists (Email or ID match)');
        }

        // 3. Create Demo User
        const userEmail = 'user@gmail.com';
        const userEmpId = 'USR-001';
        const userExists = await User.findOne({ $or: [{ email: userEmail }, { employeeId: userEmpId }] });

        if (!userExists) {
            await User.create({
                employeeId: userEmpId,
                email: userEmail,
                password: 'password123',
                firstName: 'John',
                lastName: 'Doe',
                department: 'Engineering',
                role: 'user',
                isActive: true,
                profileImage: `https://api.dicebear.com/9.x/avataaars/png?seed=${userEmail}`,
                membership: {
                    plan: '1-month',
                    startDate: new Date(),
                    expiryDate: new Date(new Date().setMonth(new Date().getMonth() + 1)),
                    status: 'active',
                    monthlyDayCount: 5, // Simulated attendance
                    lastResetDate: new Date()
                },
                preferredWorkoutStart: '18:30',
                preferredWorkoutEnd: '20:00'
            });
            console.log('✅ Demo user created: user@gmail.com / password123');
        } else {
            console.log('ℹ️ Demo user already exists (Email or ID match)');
        }

        process.exit(0);
    } catch (error) {
        console.error('❌ Seeding failed:', error);
        process.exit(1);
    }
};

seedUsers();
