import express from 'express';
import { addMeasurement, getUserMeasurements, getLatestMeasurement } from '../controllers/measurementController';
import { protect, authorize } from '../middleware/auth';

const router = express.Router();

router.use(protect);

router.post('/', authorize('admin', 'manager'), addMeasurement);
router.get('/user/:userId', getUserMeasurements);
router.get('/user/:userId/latest', getLatestMeasurement);

export default router;
