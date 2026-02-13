import express from 'express';
import { getStaffNotes, createStaffNote } from '../controllers/staffNoteController';
import { protect } from '../middleware/auth';

const router = express.Router();

router.route('/')
    .get(protect, getStaffNotes)
    .post(protect, createStaffNote);

export default router;
