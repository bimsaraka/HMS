const express = require('express');
const path = require('path');
const cors = require('cors');
require('dotenv').config();

// Database initialization
const { poolPromise, isConnected } = require('./config/db');

// Route modules
const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const receptionRoutes = require('./routes/receptionRoutes');
const opsRoutes = require('./routes/opsRoutes');
const financeRoutes = require('./routes/financeRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static assets from public directory and login page
app.use(express.static(path.join(__dirname, 'public')));
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'login.html'));
});

// DB Status check
app.get('/api/db-status', (req, res) => {
  const connected = isConnected();
  res.json({
    success: true,
    connected: connected,
    status: connected ? 'connected' : 'disconnected',
    database: 'PinnacleBayDB',
    inMemory: !connected
  });
});

// SMTP Status & Test Endpoints
app.get('/api/smtp-status', async (req, res) => {
  try {
    const { verifyConnection } = require('./utils/emailService');
    const result = await verifyConnection();
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/test-email', async (req, res) => {
  try {
    const { sendTestEmail } = require('./utils/emailService');
    const target = req.body && req.body.email ? req.body.email : process.env.EMAIL_USER;
    const result = await sendTestEmail(target);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});


// ======================================================================
// MODULAR ROLE-BASED ROUTES (MVC) & BACKWARD-COMPATIBLE ALIASES
// ======================================================================
// Auth
app.use('/api/auth', authRoutes);
app.post('/api/login', (req, res, next) => { req.url = '/login'; authRoutes(req, res, next); });

// Admin & Staff
app.use('/api/admin', adminRoutes);
app.use('/api/users', (req, res, next) => { req.url = '/users' + (req.url === '/' ? '' : req.url); adminRoutes(req, res, next); });
app.use('/api/staff', (req, res, next) => { req.url = '/staff' + (req.url === '/' ? '' : req.url); adminRoutes(req, res, next); });
app.use('/api/attendance', (req, res, next) => { req.url = '/attendance' + (req.url === '/' ? '' : req.url); adminRoutes(req, res, next); });
app.use('/api/metrics', (req, res, next) => { req.url = '/metrics'; adminRoutes(req, res, next); });

// Reception & Reservations & Rooms
app.use('/api/reception', receptionRoutes);
app.use('/api/bookings', (req, res, next) => { req.url = '/bookings' + (req.url === '/' ? '' : req.url); receptionRoutes(req, res, next); });
app.use('/api/rooms', (req, res, next) => { req.url = '/rooms' + (req.url === '/' ? '' : req.url); opsRoutes(req, res, next); });
app.use('/api/complaints', (req, res, next) => { req.url = '/complaints' + (req.url === '/' ? '' : req.url); receptionRoutes(req, res, next); });
app.use('/api/requests', (req, res, next) => { req.url = '/requests' + (req.url === '/' ? '' : req.url); receptionRoutes(req, res, next); });
app.use('/api/special-requests', (req, res, next) => { req.url = '/special-requests' + (req.url === '/' ? '' : req.url); receptionRoutes(req, res, next); });

// Operations & Housekeeping & Dining
app.use('/api/ops', opsRoutes);
app.use('/api/packages', (req, res, next) => { req.url = '/packages' + (req.url === '/' ? '' : req.url); opsRoutes(req, res, next); });
app.use('/api/maintenance', (req, res, next) => { req.url = '/maintenance' + (req.url === '/' ? '' : req.url); opsRoutes(req, res, next); });
app.use('/api/orders', (req, res, next) => { req.url = '/orders' + (req.url === '/' ? '' : req.url); opsRoutes(req, res, next); });
app.use('/api/housekeeping', (req, res, next) => { req.url = '/housekeeping' + (req.url === '/' ? '' : req.url); opsRoutes(req, res, next); });
app.use('/api/menu', (req, res, next) => { req.url = '/menu' + (req.url === '/' ? '' : req.url); opsRoutes(req, res, next); });
app.use('/api/dining', (req, res, next) => { req.url = '/dining' + (req.url === '/' ? '' : req.url); opsRoutes(req, res, next); });
app.use('/api/kitchen', (req, res, next) => { req.url = '/kitchen' + (req.url === '/' ? '' : req.url); opsRoutes(req, res, next); });

// Finance & Billing
app.use('/api/finance', financeRoutes);
app.use('/api/invoices', (req, res, next) => { req.url = '/invoices' + (req.url === '/' ? '' : req.url); financeRoutes(req, res, next); });
app.use('/api/billing', (req, res, next) => { req.url = '/invoices' + (req.url === '/' ? '' : req.url); financeRoutes(req, res, next); });
app.use('/api/transactions', (req, res, next) => { req.url = '/transactions' + (req.url === '/' ? '' : req.url); financeRoutes(req, res, next); });
app.use('/api/payroll', (req, res, next) => { req.url = '/payroll' + (req.url === '/' ? '' : req.url); financeRoutes(req, res, next); });
app.use('/api/employees', (req, res, next) => { req.url = '/employees' + (req.url === '/' ? '' : req.url); financeRoutes(req, res, next); });
app.use('/api/bills', (req, res, next) => { req.url = '/bills' + (req.url === '/' ? '' : req.url); financeRoutes(req, res, next); });
app.use('/api/payments', (req, res, next) => { req.url = '/payments' + (req.url === '/' ? '' : req.url); financeRoutes(req, res, next); });

// Reports & Audits (Global Aliases)
app.use('/api/reports', (req, res, next) => { req.url = '/reports' + (req.url === '/' ? '' : req.url); adminRoutes(req, res, next); });
app.use('/api/shift-audit', (req, res, next) => { req.url = '/shift-audit' + (req.url === '/' ? '' : req.url); adminRoutes(req, res, next); });

// JSON 404 Handler for /api/* routes (prevents HTML error returning to fetch calls)
app.use('/api', (req, res) => {
  res.status(404).json({ success: false, error: 'Endpoint not found' });
});

// Root redirect
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'login.html'));
});

// Centralized Express Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled Application Error:', err.stack || err);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Global Process Crash Prevention Boundaries
process.on('uncaughtException', (err) => {
  console.error('CRITICAL UNCAUGHT EXCEPTION:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('UNHANDLED PROMISE REJECTION:', reason);
});

// Start Server
app.listen(PORT, () => {
  console.log('====================================================');
  console.log(`🚀 Pinnacle Bay HMS Modular Server running on port ${PORT}`);
  console.log(`🌐 Local URL: http://localhost:${PORT}`);
  console.log(`📁 MVC Architecture: config/, controllers/, routes/, middleware/`);
  console.log('====================================================');
});
