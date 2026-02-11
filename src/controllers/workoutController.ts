import { Response } from 'express';
import WorkoutPlan from '../models/WorkoutPlan';
import { AuthRequest } from '../middleware/auth';
import logger from '../utils/logger';

/**
 * @desc    Assign workout plan to user
 * @route   POST /api/workouts/assign
 * @access  Private (Admin/Trainer only)
 */
export const assignWorkoutPlan = async (req: AuthRequest, res: Response) => {
    try {
        const { userId, title, description, routines } = req.body;

        // Deactivate previous active plans for this user
        await WorkoutPlan.updateMany(
            { userId, isActive: true },
            { isActive: false }
        );

        const workoutPlan = await WorkoutPlan.create({
            userId,
            assignedBy: req.user.id,
            title,
            description,
            routines,
            isActive: true
        });

        res.status(201).json({
            success: true,
            data: workoutPlan
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Get my workout plan
 * @route   GET /api/workouts/my-plan
 * @access  Private
 */
export const getMyWorkoutPlan = async (req: AuthRequest, res: Response) => {
    try {
        const plan = await WorkoutPlan.findOne({
            userId: req.user.id,
            isActive: true
        }).populate('assignedBy', 'firstName lastName');

        if (!plan) {
            return res.status(404).json({
                success: false,
                message: 'No active workout plan found'
            });
        }

        res.status(200).json({
            success: true,
            data: plan
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Get user's workout plan history
 * @route   GET /api/workouts/member/:userId
 * @access  Private (Admin/Trainer)
 */
export const getMemberWorkouts = async (req: AuthRequest, res: Response) => {
    try {
        const { userId } = req.params;
        const plans = await WorkoutPlan.find({ userId })
            .sort({ createdAt: -1 })
            .populate('assignedBy', 'firstName lastName');

        res.status(200).json({
            success: true,
            count: plans.length,
            data: plans
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Update workout plan
 * @route   PUT /api/workouts/:id
 * @access  Private (Admin/Trainer)
 */
export const updateWorkoutPlan = async (req: AuthRequest, res: Response) => {
    try {
        const { title, description, routines, isActive } = req.body;

        const plan = await WorkoutPlan.findById(req.params.id);
        if (!plan) {
            return res.status(404).json({ success: false, message: 'Plan not found' });
        }

        if (title) plan.title = title;
        if (description) plan.description = description;
        if (routines) plan.routines = routines;
        if (isActive !== undefined) plan.isActive = isActive;

        await plan.save();

        res.status(200).json({
            success: true,
            data: plan
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};
