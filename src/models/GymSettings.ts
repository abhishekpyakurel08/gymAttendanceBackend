import mongoose, { Document, Schema } from 'mongoose';

export interface IGymSettings extends Document {
    operatingHours: {
        monday: { isOpen: boolean; openTime: string; closeTime: string };
        tuesday: { isOpen: boolean; openTime: string; closeTime: string };
        wednesday: { isOpen: boolean; openTime: string; closeTime: string };
        thursday: { isOpen: boolean; openTime: string; closeTime: string };
        friday: { isOpen: boolean; openTime: string; closeTime: string };
        saturday: { isOpen: boolean; openTime: string; closeTime: string };
        sunday: { isOpen: boolean; openTime: string; closeTime: string };
    };
    gymName: string;
    gymAddress?: string;
    gymPhone?: string;
    gymEmail?: string;
    timezone: string;
    updatedBy?: string;
    updatedAt: Date;
}

const GymSettingsSchema: Schema = new Schema({
    operatingHours: {
        monday: {
            isOpen: { type: Boolean, default: true },
            openTime: { type: String, default: '05:00' },
            closeTime: { type: String, default: '20:00' }
        },
        tuesday: {
            isOpen: { type: Boolean, default: true },
            openTime: { type: String, default: '05:00' },
            closeTime: { type: String, default: '20:00' }
        },
        wednesday: {
            isOpen: { type: Boolean, default: true },
            openTime: { type: String, default: '05:00' },
            closeTime: { type: String, default: '20:00' }
        },
        thursday: {
            isOpen: { type: Boolean, default: true },
            openTime: { type: String, default: '05:00' },
            closeTime: { type: String, default: '20:00' }
        },
        friday: {
            isOpen: { type: Boolean, default: true },
            openTime: { type: String, default: '05:00' },
            closeTime: { type: String, default: '20:00' }
        },
        saturday: {
            isOpen: { type: Boolean, default: false },
            openTime: { type: String, default: '05:00' },
            closeTime: { type: String, default: '20:00' }
        },
        sunday: {
            isOpen: { type: Boolean, default: true },
            openTime: { type: String, default: '05:00' },
            closeTime: { type: String, default: '20:00' }
        }
    },
    gymName: { type: String, default: 'Shankhamul Gym' },
    gymAddress: { type: String, default: '' },
    gymPhone: { type: String, default: '' },
    gymEmail: { type: String, default: '' },
    timezone: { type: String, default: 'Asia/Kathmandu' },
    updatedBy: { type: String },
    updatedAt: { type: Date, default: Date.now }
});

export default mongoose.model<IGymSettings>('GymSettings', GymSettingsSchema);
