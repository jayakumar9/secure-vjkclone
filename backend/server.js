const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const mongoose = require('mongoose');

// Load env vars
dotenv.config();

// MongoDB Connection with Status Monitoring
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/secure-data');
    console.log('\x1b[42m%s\x1b[0m', '[Database Status]: MongoDB Connected Successfully');
    console.log('\x1b[36m%s\x1b[0m', `[Server]: Connected to ${conn.connection.host}`);
    
    // Monitor database connection
    mongoose.connection.on('connected', () => {
      console.log('\x1b[42m%s\x1b[0m', '[Database Status]: MongoDB Connected');
    });

    mongoose.connection.on('error', (err) => {
      console.log('\x1b[41m%s\x1b[0m', '[Database Status]: MongoDB Connection Error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.log('\x1b[43m%s\x1b[0m', '[Database Status]: MongoDB Disconnected');
    });

    // Handle process termination
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      console.log('\x1b[43m%s\x1b[0m', '[Database Status]: MongoDB disconnected through app termination');
      process.exit(0);
    });

  } catch (error) {
    console.error('\x1b[41m%s\x1b[0m', '[Database Error]:', error.message);
    process.exit(1);
  }
};

// Connect to Database
connectDB();

const app = express();

// Trust proxy configuration
app.set('trust proxy', 1);

// Body parser
app.use(express.json());

// Enable CORS
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Security headers
app.use(helmet());

// Rate limiting
const limiter = rateLimit({
  windowMs: process.env.RATE_LIMIT_WINDOW * 60 * 1000, // 15 minutes
  max: process.env.RATE_LIMIT_MAX // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Mount routers
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/accounts', require('./routes/accountRoutes'));

// Health Check Endpoint with more detailed information
app.get('/api/health', (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected';
  const dbState = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };
  
  res.json({
    status: 'OK',
    timestamp: new Date(),
    database: {
      status: dbStatus,
      state: dbState[mongoose.connection.readyState],
      host: mongoose.connection.host,
      name: mongoose.connection.name,
      port: mongoose.connection.port
    },
    server: {
      uptime: process.uptime(),
      timestamp: Date.now()
    }
  });
});

// Error handling middleware with more detail
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    success: false,
    error: process.env.NODE_ENV === 'development' ? err.message : 'Server Error',
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log('\x1b[36m%s\x1b[0m', `[Server]: Server running on port ${PORT}`);
  console.log('\x1b[36m%s\x1b[0m', `[Server]: Health check available at http://localhost:${PORT}/health`);
}); 