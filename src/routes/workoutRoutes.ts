import express from 'express';
import { assignWorkoutPlan, getMyWorkoutPlan, getMemberWorkouts, updateWorkoutPlan } from '../controllers/workoutController';
import { protect, authorize } from '../middleware/auth';

const router = express.Router();

router.use(protect);

// Member routes
router.get('/my-plan', getMyWorkoutPlan);

// Admin/Manager/Trainer routes
router.post('/assign', authorize('admin', 'manager'), assignWorkoutPlan);
router.get('/member/:userId', authorize('admin', 'manager'), getMemberWorkouts);
router.put('/:id', authorize('admin', 'manager'), updateWorkoutPlan);

export default router;
