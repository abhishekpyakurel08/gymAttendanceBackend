import mongoose, { Document, Schema } from 'mongoose';

export interface IMeasurement extends Document {
    userId: mongoose.Types.ObjectId;
    recordedBy: mongoose.Types.ObjectId;
    date: Date;
    weight?: number; // kg
    height?: number; // cm
    bmi?: number;
    bodyFatPercentage?: number;
    chest?: number; // cm
    waist?: number; // cm
    arms?: number; // cm
    legs?: number; // cm
    notes?: string;
    createdAt: Date;
}

const MeasurementSchema = new Schema<IMeasurement>({
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    recordedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: Date, default: Date.now },
    weight: Number,
    height: Number,
    bmi: Number,
    bodyFatPercentage: Number,
    chest: Number,
    waist: Number,
    arms: Number,
    legs: Number,
    notes: String
}, {
    timestamps: true
});

// Calculate BMI before saving if weight and height are present
MeasurementSchema.pre('save', function (next) {
    if (this.weight && this.height) {
        const heightInMeters = this.height / 100;
        this.bmi = parseFloat((this.weight / (heightInMeters * heightInMeters)).toFixed(2));
    }
    next();
});

export default mongoose.model<IMeasurement>('Measurement', MeasurementSchema);
