import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

// Import routes and error handlers
import authRoutes from './routes/authRoutes.js';
import k8sRoutes from './routes/k8sRoutes.js';
import { notFoundHandler, globalErrorHandler } from './middleware/errorMiddleware.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;

// ==========================================
// SECURITY & LOGGING MIDDLEWARES
// ==========================================

// HTTP header security
app.use(helmet());

// Cross-Origin Resource Sharing (allow frontend access)
app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Request Logger
app.use(morgan('dev'));

// Parse incoming JSON payloads
app.use(express.json());

// API Rate Limiting to prevent denial-of-service
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many API requests from this IP. Please try again after 15 minutes.'
  }
});
app.use('/api', limiter);

// ==========================================
// ROUTES REGISTRATION
// ==========================================

// Mount Public Auth endpoints
app.use('/api/auth', authRoutes);

// Mount Protected Kubernetes endpoints
app.use('/api', k8sRoutes);

// ==========================================
// FALLBACK & ERROR HANDLERS
// ==========================================

// Unhandled route catcher
app.use(notFoundHandler);

// Global exception catcher
app.use(globalErrorHandler);

// Start Server
app.listen(PORT, () => {
  console.log(`🚀 Kubernetes Dashboard Server started on port ${PORT}`);
  console.log(`📡 Base API access URL: http://localhost:${PORT}/api`);
});
