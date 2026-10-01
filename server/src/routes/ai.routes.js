const { Router } = require('express');
const c = require('../controllers/ai.controller');
const { requireAuth } = require('../middleware/auth.middleware');
const { internalOnly } = require('../middleware/role.middleware');
const { aiLimiter } = require('../middleware/rateLimit.middleware');

const router = Router();
router.use(requireAuth, aiLimiter);

// Internal analytical features
router.get('/usage-summary', internalOnly, c.usageSummary);
router.post('/demand-forecast', internalOnly, c.demandForecast);
router.post('/anomaly-detection', internalOnly, c.anomalyDetector);
router.post('/report-narrative', internalOnly, c.reportNarrative);
router.post('/nl-dispatch', internalOnly, c.nlDispatch);
router.post('/chatbot', c.chatbot); // customers + internal

router.get('/predictive-maintenance/:vehicleId', internalOnly, c.predictiveMaintenance);
router.get('/driver-analysis/:driverId', internalOnly, c.driverAnalyzer);
router.get('/eta/:orderId', c.etaPredictor);
router.get('/churn/:customerId', internalOnly, c.churnPredictor);

module.exports = router;
