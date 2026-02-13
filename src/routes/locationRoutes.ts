import express from 'express';
import {
    getLocations,
    validateLocation,
    createLocation,
    updateLocation,
    deleteLocation
} from '../controllers/locationController';
import { protect } from '../middleware/auth';

const router = express.Router();

// Public routes (or private for app usage)
router.get('/target', protect, getLocations);
router.post('/validate', protect, validateLocation);

// Admin only routes
router.post('/', protect, createLocation);
router.put('/:id', protect, updateLocation);
router.delete('/:id', protect, deleteLocation);

export default router;
