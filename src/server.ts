import express, { Application, Request, Response } from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import connectDB from './config/database';
import logger from './utils/logger';
import notificationService from './utils/notificationService';
import firebaseService from './utils/firebaseService';

// Import routes
import authRoutes from './routes/authRoutes';
import attendanceRoutes from './routes/attendanceRoutes';
import financeRoutes from './routes/financeRoutes';
import notificationRoutes from './routes/notificationRoutes';
import adminRoutes from './routes/adminRoutes';

// Load environment variables
dotenv.config();

// Initialize express app
const app: Application = express();
const httpServer = createServer(app);

// Initialize Socket.io
const io = new Server(httpServer, {
    cors: {
        origin: '*', // Adjust for production
        methods: ['GET', 'POST']
    }
});

// Initialize Notification Service
notificationService.init(io);
firebaseService.init();

// Initialize Scheduler Service (Expiry & Inactivity Notifications)
import schedulerService from './utils/schedulerService';
schedulerService.init();

// Connect to database
connectDB();

// Security Middlewares
app.use(helmet());
app.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
    credentials: true
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    message: 'Too many requests from this IP, please try again after 15 minutes',
    standardHeaders: true,
    legacyHeaders: false,
});

if (process.env.NODE_ENV === 'production') {
    app.use('/api', limiter);
}

// Logging
app.use(morgan('combined', {
    stream: { write: (message: string) => logger.info(message.trim()) }
}));

app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Routes
app.get("/health",(req:Request,res:Response) => {
    res.send("API IS WORKING")
})
app.use('/api/auth', authRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/finance', financeRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin', adminRoutes);

// Health check route
import mongoose from 'mongoose';

app.get('/health', (req: Request, res: Response) => {
    const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    res.status(200).json({
        success: true,
        message: 'Server is healthy',
        database: dbStatus,
        timestamp: new Date().toISOString()
    });
});

// Root route
app.get('/', (req: Request, res: Response) => {
    res.status(200).json({
        success: true,
        message: 'Shankhamul Gym Attendance API',
        version: '1.0.0'
    });
});

// 404 handler
app.use((req: Request, res: Response) => {
    res.status(404).json({
        success: false,
        message: `Can't find ${req.originalUrl} on this server!`
    });
});

// Global error handler
app.use((err: any, req: Request, res: Response, next: any) => {
    logger.error(err.message, { stack: err.stack });

    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({
        success: false,
        message: process.env.NODE_ENV === 'production'
            ? 'Something went wrong!'
            : err.message,
        ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
    });
});

// Start server
const PORT = process.env.PORT || 5000;

httpServer.listen(PORT, () => {
    logger.info(` Server running on port ${PORT}`);
    logger.info(` Environment: ${process.env.NODE_ENV || 'development'}`);
});
