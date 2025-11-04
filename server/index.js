require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');

const db = require('./config/database');
const logger = require('./config/logger');

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const attendanceRoutes = require('./routes/attendance');
const breakRoutes = require('./routes/breaks');
const workOrderRoutes = require('./routes/workOrders');
console.log('Loading workSessions routes...');
let workSessionRoutes;
try {
  workSessionRoutes = require('./routes/workSessions');
  console.log('WorkSessions routes loaded successfully:', !!workSessionRoutes);
} catch (error) {
  console.error('ERROR LOADING WORK SESSIONS ROUTES:', error);
  console.error('STACK:', error.stack);
  process.exit(1);
}
const categoryRoutes = require('./routes/categories');
const workOrderCategoryRoutes = require('./routes/workOrderCategories');
const reportRoutes = require('./routes/reports');
const performanceRoutes = require('./routes/performance');
const systemRoutes = require('./routes/system');
const statisticsRoutes = require('./routes/statistics');

const app = express();
const PORT = process.env.PORT || 3001;

// Trust proxy for Docker setup to fix rate limiting issues
app.set('trust proxy', true);

// Security middleware
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
}));

app.use(compression());

// CORS configuration
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? process.env.CLIENT_URL 
    : ['http://localhost:3000', 'http://localhost:80'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    error: 'Zu viele Anfragen von dieser IP-Adresse. Bitte versuchen Sie es später erneut.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  trustProxy: false, // Fix for Docker proxy setup
});

// Temporarily disable slowDown as well
// const speedLimiter = slowDown({
//   windowMs: 15 * 60 * 1000, // 15 minutes
//   delayAfter: 50, // allow 50 requests per 15 minutes, then...
//   delayMs: () => 500, // begin adding 500ms of delay per request above 50
//   trustProxy: false, // Fix for Docker proxy setup
// });

// Temporarily disable rate limiting for debugging
// app.use('/api', limiter);
// app.use('/api', speedLimiter);

// Temporarily disable auth rate limiting as well for debugging
// const authLimiter = rateLimit({
//   windowMs: 15 * 60 * 1000, // 15 minutes
//   max: 100, // increased limit for development
//   message: {
//     error: 'Zu viele Anmeldeversuche. Bitte versuchen Sie es später erneut.'
//   },
//   trustProxy: false, // Fix for Docker proxy setup
// });

// app.use('/api/auth/login', authLimiter);
// app.use('/api/auth/kiosk', authLimiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use((req, res, next) => {
  console.log(`=== INCOMING REQUEST: ${req.method} ${req.url} ===`);
  console.log('Full path:', req.path);
  console.log('Query:', req.query);
  console.log('Body:', req.method === 'POST' || req.method === 'PUT' || req.method === 'DELETE' ? req.body : undefined);
  
  logger.info(`${req.method} ${req.url}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    body: req.method === 'POST' || req.method === 'PUT' ? req.body : undefined
  });
  next();
});

// Health check endpoint
app.get('/api/health', async (req, res) => {
  const health = {
    uptime: process.uptime(),
    message: 'OK',
    timestamp: new Date().toISOString(),
    database: db.isHealthy() ? 'connected' : 'disconnected'
  };

  try {
    // Test database connection
    await db.query('SELECT 1');
    health.database = 'connected';
    res.status(200).json(health);
  } catch (error) {
    health.database = 'error';
    health.error = error.message;
    res.status(503).json(health);
  }
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/breaks', breakRoutes);
app.use('/api/work-orders', workOrderRoutes);
console.log('Registering workSessions routes...');
app.use('/api/work-sessions', workSessionRoutes);
console.log('WorkSessions routes registered');
app.use('/api/categories', categoryRoutes);
app.use('/api/work-order-categories', workOrderCategoryRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/performance', performanceRoutes);
app.use('/api/system', systemRoutes);
app.use('/api/statistics', statisticsRoutes);

// API documentation route
app.get('/api', (req, res) => {
  res.json({
    name: 'Auftragsuhr API',
    version: '1.0.0',
    description: 'Zeiterfassung für KFZ/Motorrad-Werkstätten',
    endpoints: {
      auth: '/api/auth',
      users: '/api/users',
      attendance: '/api/attendance',
      breaks: '/api/breaks',
      workOrders: '/api/work-orders',
      workSessions: '/api/work-sessions',
      categories: '/api/categories',
      workOrderCategories: '/api/work-order-categories',
      reports: '/api/reports',
      performance: '/api/performance',
      system: '/api/system',
      health: '/api/health'
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip
  });

  if (err.name === 'ValidationError') {
    return res.status(400).json({ 
      error: 'Validation failed', 
      details: err.details 
    });
  }

  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ 
      error: 'Duplicate entry', 
      message: 'Resource already exists' 
    });
  }

  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : err.message
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await db.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  await db.close();
  process.exit(0);
});

// Start server
const startServer = async () => {
  try {
    // Connect to database
    await db.connect();
    
    // Initialize admin user
    const initAdmin = require('./init-admin');
    await initAdmin();
    
    // Start listening
    app.listen(PORT, '0.0.0.0', () => {
      logger.info(`Server started on port ${PORT}`, {
        environment: process.env.NODE_ENV,
        port: PORT
      });
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();