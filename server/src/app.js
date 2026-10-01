const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const { clerkMiddleware } = require('@clerk/express');

const rateLimit = require('./middleware/rateLimit.middleware');
const errorMiddleware = require('./middleware/error.middleware');
const logger = require('./utils/logger.util');

const app = express();

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(
  cors({
    origin: [process.env.CLIENT_URL, 'http://localhost:3000', 'http://localhost:8081'],
    credentials: true,
  })
);
// Webhooks MUST be parsed before express.json() so the raw body is preserved
// for Stripe signature verification and Clerk payload parsing.
app.use('/api/webhooks/stripe', require('./routes/webhooks.stripe.routes'));
app.use('/api/webhooks/clerk', require('./routes/webhooks.clerk.routes'));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev', { stream: { write: (msg) => logger.info(msg.trim()) } }));

// Clerk authentication (verifies JWTs; route-level guards decide public vs protected)
app.use(clerkMiddleware());

// Locally uploaded files (documents, licenses, photos, delivery proofs)
app.use(
  `/${process.env.UPLOAD_DIR || 'uploads'}`,
  express.static(path.join(process.cwd(), process.env.UPLOAD_DIR || 'uploads'))
);

// Global rate limit
app.use('/api', rateLimit.apiLimiter);

// ─── Routes (mounted per domain) ────────────────────────────────────────────
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/uploads', require('./routes/upload.routes'));
app.use('/api/organizations', require('./routes/organization.routes'));
app.use('/api/fleet', require('./routes/fleet.routes'));
app.use('/api/vehicles', require('./routes/vehicle.routes'));
app.use('/api/drivers', require('./routes/driver.routes'));
app.use('/api/orders', require('./routes/order.routes'));
app.use('/api/shipments', require('./routes/shipment.routes'));
app.use('/api/routes', require('./routes/route.routes'));
app.use('/api/dispatch', require('./routes/dispatch.routes'));
app.use('/api/tracking', require('./routes/tracking.routes'));
app.use('/api/warehouses', require('./routes/warehouse.routes'));
app.use('/api/inventory', require('./routes/inventory.routes'));
app.use('/api/maintenance', require('./routes/maintenance.routes'));
app.use('/api/fuel', require('./routes/fuel.routes'));
app.use('/api/compliance', require('./routes/compliance.routes'));
app.use('/api/customers', require('./routes/customer.routes'));
app.use('/api/invoices', require('./routes/invoice.routes'));
app.use('/api/analytics', require('./routes/analytics.routes'));
app.use('/api/notifications', require('./routes/notification.routes'));
app.use('/api/ai', require('./routes/ai.routes'));
app.use('/api/reports', require('./routes/report.routes'));
app.use('/api/admin', require('./routes/admin.routes'));

app.get('/api/health', (req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

// 404
app.use((req, res) => res.status(404).json({ success: false, message: 'Route not found' }));

// Central error handler
app.use(errorMiddleware);

module.exports = app;
