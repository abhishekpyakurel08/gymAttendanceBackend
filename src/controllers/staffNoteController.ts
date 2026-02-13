import { Request, Response } from 'express';
import StaffNote from '../models/StaffNote';
import { AuthRequest } from '../middleware/auth';

/**
 * @desc    Get all staff notes
 * @route   GET /api/staff-notes
 */
export const getStaffNotes = async (req: Request, res: Response) => {
    try {
        const notes = await StaffNote.find()
            .populate('userId', 'firstName lastName')
            .sort({ createdAt: -1 })
            .limit(20);

        // Map to format frontend expects
        const formattedNotes = notes.map(n => ({
            id: n._id,
            user: (n.userId as any).firstName + ' ' + (n.userId as any).lastName,
            text: n.text,
            createdAt: n.createdAt
        }));

        res.status(200).json({
            success: true,
            data: formattedNotes.reverse() // Chronological for the chat-like view
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Create a staff note
 * @route   POST /api/staff-notes
 */
export const createStaffNote = async (req: AuthRequest, res: Response) => {
    try {
        const { text } = req.body;
        if (!text) {
            return res.status(400).json({ success: false, message: 'Text is required' });
        }

        const note = await StaffNote.create({
            userId: req.user._id,
            text
        });

        const populatedNote = await StaffNote.findById(note._id).populate('userId', 'firstName lastName');

        const formattedNote = {
            id: populatedNote?._id,
            user: (populatedNote?.userId as any).firstName + ' ' + (populatedNote?.userId as any).lastName,
            text: populatedNote?.text,
            createdAt: populatedNote?.createdAt
        };

        res.status(201).json({
            success: true,
            data: formattedNote
        });

        // 🔄 BROADCAST
        const notificationService = require('../utils/notificationService').default;
        notificationService.sendAdminNotification('staff_note_added', formattedNote);

    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};
