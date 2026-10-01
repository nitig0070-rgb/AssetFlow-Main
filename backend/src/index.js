import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { initDb } from './config/db.js';
import authRoutes from './routes/auth.js';
import dashboardRoutes from './routes/dashboard.js';
import assetRoutes from './routes/assets.js';
import bookingRoutes from './routes/bookings.js';
import maintenanceRoutes from './routes/maintenance.js';
import departmentRoutes from './routes/departments.js';
import categoryRoutes from './routes/categories.js';
import userRoutes from './routes/users.js';
import allocationRoutes from './routes/allocations.js';
import transferRoutes from './routes/transfers.js';
import auditRoutes from './routes/audits.js';
import logRoutes from './routes/logs.js';
import { errorHandler } from './middleware/errorHandler.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Health Check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes mounting
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/assets', assetRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/maintenance', maintenanceRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/users', userRoutes);
app.use('/api/allocations', allocationRoutes);
app.use('/api/transfers', transferRoutes);
app.use('/api/audits', auditRoutes);
app.use('/api/logs', logRoutes);

// Unhandled Endpoint Handler
app.use((req, res, next) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.url}` });
});

// Error handling middleware (must be registered last)
app.use(errorHandler);

// Initialize DB and start server
async function startServer() {
  try {
    console.log('Initializing database...');
    await initDb();
    
    app.listen(PORT, () => {
      console.log(`=================================================`);
      console.log(` AssetFlow Backend Server running on port ${PORT}`);
      console.log(` Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(` Health check: http://localhost:${PORT}/health`);
      console.log(`=================================================`);
    });
  } catch (error) {
    console.error('Failed to initialize database or start server:', error);
    process.exit(1);
  }
}

startServer();
