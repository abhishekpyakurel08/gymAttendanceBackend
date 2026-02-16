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
                department: 'Operations',
                role: 'user',
                isActive: true,
                profileImage: `https://api.dicebear.com/9.x/avataaars/png?seed=${userEmail}`,
                membership: {
                    plan: '1-month',
                    startDate: new Date(),
                    expiryDate: new Date(Date.now() + 26 * 24 * 60 * 60 * 1000), // 26 days
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

        // 4. Create Owner (Admin)
        const ownerEmail = 'owner@gmail.com';
        const ownerEmpId = 'ADMIN-002';
        await User.deleteOne({ $or: [{ email: ownerEmail }, { employeeId: ownerEmpId }] });
        await User.create({
            employeeId: ownerEmpId,
            email: ownerEmail,
            password: 'password123',
            firstName: 'Ram',
            lastName: 'Owner',
            department: 'Management',
            role: 'admin',
            isActive: true,
            profileImage: `https://api.dicebear.com/9.x/avataaars/png?seed=${ownerEmail}`
        });
        console.log('✅ Owner Admin created: owner@gmail.com / password123');

        // 5. Create Trainer (Manager)
        const trainerEmail = 'trainer@gmail.com';
        const trainerEmpId = 'MGR-002';
        await User.deleteOne({ $or: [{ email: trainerEmail }, { employeeId: trainerEmpId }] });
        await User.create({
            employeeId: trainerEmpId,
            email: trainerEmail,
            password: 'password123',
            firstName: 'Bhola',
            lastName: 'Trainer',
            department: 'Operations',
            role: 'manager',
            isActive: true,
            profileImage: `https://api.dicebear.com/9.x/avataaars/png?seed=${trainerEmail}`
        });
        console.log('✅ Trainer Manager created: trainer@gmail.com / password123');

        // 6. Create Receptionist (Specific Reception Role)
        const recEmail = 'reception@gmail.com';
        const recEmpId = 'REC-001';
        await User.deleteOne({ $or: [{ email: recEmail }, { employeeId: recEmpId }] });
        await User.create({
            employeeId: recEmpId,
            email: recEmail,
            password: 'password123',
            firstName: 'Rita',
            lastName: 'Reception',
            department: 'Reception',
            role: 'reception',
            isActive: true,
            profileImage: `https://api.dicebear.com/9.x/avataaars/png?seed=${recEmail}`,
            shift: 'morning',
            salary: 15000
        });
        console.log('✅ Receptionist created: reception@gmail.com / password123');

        // 7. Create Member A - 3 month active
        const memberAEmail = 'memberA@gmail.com';
        const memberAEmpId = 'USR-002';
        await User.deleteOne({ $or: [{ email: memberAEmail }, { employeeId: memberAEmpId }] });
        await User.create({
            employeeId: memberAEmpId,
            email: memberAEmail,
            password: 'password123',
            firstName: 'Alice',
            lastName: 'Member',
            department: 'Operations',
            role: 'user',
            isActive: true,
            profileImage: `https://api.dicebear.com/9.x/avataaars/png?seed=${memberAEmail}`,
            membership: {
                plan: '3-month',
                startDate: new Date(),
                expiryDate: new Date(Date.now() + 78 * 24 * 60 * 60 * 1000), // 78 days
                status: 'active',
                monthlyDayCount: 0,
                lastResetDate: new Date()
            }
        });
        console.log('✅ Member A created: memberA@gmail.com / password123');

        // 8. Create Expired Member
        const memberBEmail = 'memberB@gmail.com';
        const memberBEmpId = 'USR-003';
        await User.deleteOne({ $or: [{ email: memberBEmail }, { employeeId: memberBEmpId }] });
        await User.create({
            employeeId: memberBEmpId,
            email: memberBEmail,
            password: 'password123',
            firstName: 'Bob',
            lastName: 'Expired',
            department: 'Operations',
            role: 'user',
            isActive: true,
            profileImage: `https://api.dicebear.com/9.x/avataaars/png?seed=${memberBEmail}`,
            membership: {
                plan: '1-month',
                startDate: new Date(new Date().setMonth(new Date().getMonth() - 2)),
                expiryDate: new Date(new Date().getTime() - 30 * 24 * 60 * 60 * 1000 + 26 * 24 * 60 * 60 * 1000), // Start -30 days, plus 26 days = -4 days (Expired)
                status: 'expired',
                monthlyDayCount: 0,
                lastResetDate: new Date()
            }
        });
        console.log('✅ Expired member created: memberB@gmail.com / password123');

        // 9. Create Pending Member (Just registered via admission)
        const pendingEmail = 'pending@gmail.com';
        const pendingEmpId = 'USR-004';
        await User.deleteOne({ $or: [{ email: pendingEmail }, { employeeId: pendingEmpId }] });
        await User.create({
            employeeId: pendingEmpId,
            email: pendingEmail,
            password: 'password123',
            firstName: 'Prashant',
            lastName: 'Wait',
            department: 'Operations',
            role: 'user',
            isActive: true,
            profileImage: `https://api.dicebear.com/9.x/avataaars/png?seed=${pendingEmail}`,
            membership: {
                plan: 'none',
                startDate: new Date(),
                expiryDate: new Date(),
                status: 'pending',
                monthlyDayCount: 0,
                lastResetDate: new Date()
            }
        });
        console.log('✅ Pending member created: pending@gmail.com / password123');

        // 10. Create Default Location (Shankhamul Gym)
        const Location = require('./models/Location').default;
        await Location.deleteMany({});
        await Location.create({
            name: 'Shankhamul Gym',
            address: 'Shankhamul, Kathmandu',
            latitude: 27.684185017430245,
            longitude: 85.33338702577204,
            radius: 100,
            isActive: true
        });
        console.log('✅ Default Location seeded: Shankhamul Gym');

        process.exit(0);
    } catch (error) {
        console.error('❌ Seeding failed:', error);
        process.exit(1);
    }
};

seedUsers();
