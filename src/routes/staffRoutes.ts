import express from 'express';
import { getAllStaff, updateStaffProfile, payStaffSalary, getStaffAttendance } from '../controllers/staffController';
import { protect, authorize } from '../middleware/auth';

const router = express.Router();

router.use(protect);
router.use(authorize('admin', 'manager'));

router.get('/', getAllStaff);
router.put('/:id', updateStaffProfile);
router.post('/:id/pay', payStaffSalary);
router.get('/:id/attendance', getStaffAttendance);

export default router;
