import mongoose, { Document, Schema } from 'mongoose';

export interface IExercise {
    name: string;
    sets: number;
    reps: string;
    weight?: string;
    notes?: string;
}

export interface IRoutine {
    day: 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';
    exercises: IExercise[];
}

export interface IWorkoutPlan extends Document {
    userId: mongoose.Types.ObjectId;
    assignedBy: mongoose.Types.ObjectId;
    title: string;
    description?: string;
    routines: IRoutine[];
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}

const ExerciseSchema = new Schema<IExercise>({
    name: { type: String, required: true },
    sets: { type: Number, required: true },
    reps: { type: String, required: true },
    weight: { type: String },
    notes: { type: String }
});

const RoutineSchema = new Schema<IRoutine>({
    day: {
        type: String,
        enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
        required: true
    },
    exercises: [ExerciseSchema]
});

const WorkoutPlanSchema = new Schema<IWorkoutPlan>({
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    assignedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true },
    description: { type: String },
    routines: [RoutineSchema],
    isActive: { type: Boolean, default: true }
}, {
    timestamps: true
});

export default mongoose.model<IWorkoutPlan>('WorkoutPlan', WorkoutPlanSchema);
