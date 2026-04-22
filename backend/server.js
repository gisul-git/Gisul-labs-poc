require('dotenv').config();
const express = require('express');
const expressWs = require('express-ws');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');

const connectDB = require('./db');
const authRoutes = require('./routes/auth');
const vmRoutes = require('./routes/vm');
const createConsoleRouter = require('./routes/console');
const usageRoutes = require('./routes/usage');
const labRoutes = require('./routes/lab');
const { authenticate } = require('./middlewares/auth');

// Connect to MongoDB Atlas
connectDB();

const app = express();
expressWs(app); // must be called before routes that use .ws()

// Trust proxy (needed behind nginx/load balancer)
app.set('trust proxy', 1);

// CORS — allow frontend origin with credentials
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));

app.use(express.json());
app.use(cookieParser());

// Global rate limiter
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});
app.use(globalLimiter);

// Stricter limiter for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many login attempts, please try again later.' },
});

// Routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/vm', authenticate, vmRoutes);
app.use('/api/console', authenticate, createConsoleRouter(app));
app.use('/api/usage', authenticate, usageRoutes);
app.use('/api/labs', authenticate, labRoutes);

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Global error handler
app.use((err, req, res, next) => {
  console.error('[Error]', err.message);
  const status = err.status || 500;
  res.status(status).json({ error: err.message || 'Internal server error' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
