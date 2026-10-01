const { Router } = require('express');
const c = require('../controllers/analytics.controller');
const { requireAuth } = require('../middleware/auth.middleware');
const { internalOnly } = require('../middleware/role.middleware');

const router = Router();
router.use(requireAuth, internalOnly);

router.get('/overview', c.overview);
router.get('/timeseries', c.timeseries);
router.get('/order-status', c.orderStatusBreakdown);
router.get('/top-customers', c.topCustomers);
router.get('/driver-leaderboard', c.driverLeaderboard);
router.get('/fleet-utilization', c.fleetUtilization);
router.get('/on-time-rate', c.onTimeRate);
router.get('/cost-summary', c.costSummary);
router.get('/revenue', c.revenue);
router.get('/snapshots', c.snapshots);

module.exports = router;
