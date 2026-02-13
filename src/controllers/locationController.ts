import { Request, Response } from 'express';
import Location from '../models/Location';
import { AuthRequest } from '../middleware/auth';

/**
 * Calculate distance between two GPS coordinates using Haversine formula
 * Returns distance in meters
 */
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
}

// @desc    Get all active target locations
// @route   GET /api/locations/target
// @access  Private
export const getLocations = async (req: AuthRequest, res: Response) => {
    try {
        const locations = await Location.find({ isActive: true });
        res.status(200).json({
            success: true,
            count: locations.length,
            data: locations
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Validate user location
// @route   POST /api/locations/validate
// @access  Private
export const validateLocation = async (req: AuthRequest, res: Response) => {
    try {
        const { latitude, longitude } = req.body;

        if (!latitude || !longitude) {
            return res.status(400).json({ success: false, message: 'Please include latitude and longitude' });
        }

        const locations = await Location.find({ isActive: true });

        let isValid = false;
        let minDistance = Infinity;
        let nearestLocation = null;

        for (const loc of locations) {
            const distance = calculateDistance(latitude, longitude, loc.latitude, loc.longitude);
            if (distance < minDistance) {
                minDistance = distance;
                nearestLocation = loc;
            }
            if (distance <= loc.radius) {
                isValid = true;
                // If valid, we can break early if we don't care about nearest?
                // But let's find truly nearest valid one.
                // Actually if valid, nearest is likely the one we are in.
            }
        }

        if (isValid && nearestLocation) {
            res.status(200).json({
                success: true,
                isValid: true,
                nearestLocation: {
                    name: nearestLocation.name,
                    distance: Math.round(minDistance)
                },
                message: 'Location is valid'
            });
        } else {
            res.status(200).json({ // Return 200 with isValid: false per spec
                success: true,
                isValid: false,
                nearestLocation: nearestLocation ? {
                    name: nearestLocation.name,
                    distance: Math.round(minDistance)
                } : null,
                message: 'You are not at any office location.'
            });
        }

    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Create new location (Admin)
// @route   POST /api/locations
// @access  Private (Admin)
export const createLocation = async (req: AuthRequest, res: Response) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Not authorized' });
        }

        const location = await Location.create(req.body);

        res.status(201).json({
            success: true,
            data: location
        });

        // 📍 BROADCAST TO ALL CLIENTS
        const notificationService = require('../utils/notificationService').default;
        notificationService.sendAdminNotification('location_created', { location });
        notificationService.sendBroadcastNotification('location_created', { location });
        notificationService.sendAdminNotification('stats_updated', { type: 'system' });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Update location (Admin)
// @route   PUT /api/locations/:id
// @access  Private (Admin)
export const updateLocation = async (req: AuthRequest, res: Response) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Not authorized' });
        }

        const location = await Location.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true
        });

        if (!location) {
            return res.status(404).json({ success: false, message: 'Location not found' });
        }

        res.status(200).json({
            success: true,
            data: location
        });

        // 📍 BROADCAST TO ALL CLIENTS
        const notificationService = require('../utils/notificationService').default;
        notificationService.sendAdminNotification('location_updated', { location });
        notificationService.sendBroadcastNotification('location_updated', { location });
        notificationService.sendAdminNotification('stats_updated', { type: 'system' });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Delete location (Admin)
// @route   DELETE /api/locations/:id
// @access  Private (Admin)
export const deleteLocation = async (req: AuthRequest, res: Response) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Not authorized' });
        }

        const location = await Location.findById(req.params.id);
        if (!location) {
            return res.status(404).json({ success: false, message: 'Location not found' });
        }

        await location.deleteOne(); // or findByIdAndDelete

        res.status(200).json({
            success: true,
            data: {}
        });

        // 📍 BROADCAST TO ALL CLIENTS
        const notificationService = require('../utils/notificationService').default;
        notificationService.sendAdminNotification('location_deleted', { id: req.params.id });
        notificationService.sendBroadcastNotification('location_deleted', { id: req.params.id });
        notificationService.sendAdminNotification('stats_updated', { type: 'system' });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};
