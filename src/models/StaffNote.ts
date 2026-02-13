import mongoose, { Schema, Document } from 'mongoose';

export interface IStaffNote extends Document {
    userId: mongoose.Types.ObjectId;
    text: string;
    createdAt: Date;
}

const StaffNoteSchema: Schema = new Schema({
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, required: true },
}, { timestamps: true });

export default mongoose.model<IStaffNote>('StaffNote', StaffNoteSchema);
