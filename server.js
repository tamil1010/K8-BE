import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

// Import routes and error handlers
import authRoutes from './routes/authRoutes.js';
import k8sRoutes from './routes/k8sRoutes.js';
import podRoutes from './routes/podRoutes.js';
import { notFoundHandler, globalErrorHandler } from './middleware/errorMiddleware.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;

// ==========================================
// SECURITY & LOGGING MIDDLEWARES
// ==========================================

// HTTP header security
app.use(helmet());

// Cross-Origin Resource Sharing
// Dynamically allow any localhost origin (e.g. 5173, 5174, 5175 etc.)
// so Vite port increments never break the connection.
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. curl, Postman, server-to-server)
    if (!origin) return callback(null, true);
    // Allow any localhost or 127.0.0.1 origin on any port
    if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
      return callback(null, true);
    }
    callback(new Error(`CORS policy: Origin "${origin}" is not allowed.`));
  },
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

// Mount Pods-specific endpoints
app.use('/api', podRoutes);

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
