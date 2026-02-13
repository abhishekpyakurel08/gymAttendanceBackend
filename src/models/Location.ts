import mongoose, { Document, Schema } from 'mongoose';

export interface ILocation extends Document {
    name: string;
    address: string;
    latitude: number;
    longitude: number;
    radius: number;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}

const LocationSchema: Schema = new Schema({
    name: {
        type: String,
        required: [true, 'Please add a location name'],
        trim: true,
        maxlength: [50, 'Name can not be more than 50 characters']
    },
    address: {
        type: String,
        required: [true, 'Please add an address']
    },
    latitude: {
        type: Number,
        required: [true, 'Please add latitude'],
        min: -90,
        max: 90
    },
    longitude: {
        type: Number,
        required: [true, 'Please add longitude'],
        min: -180,
        max: 180
    },
    radius: {
        type: Number,
        default: 200, // meters
        min: 10
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

// Index for geospatial queries if needed later
LocationSchema.index({ latitude: 1, longitude: 1 });

export default mongoose.model<ILocation>('Location', LocationSchema);
