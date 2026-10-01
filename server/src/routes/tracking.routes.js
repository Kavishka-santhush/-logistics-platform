const { Router } = require('express');
const c = require('../controllers/tracking.controller');
const { requireAuth } = require('../middleware/auth.middleware');
const { internalOnly } = require('../middleware/role.middleware');
const { trackingLimiter } = require('../middleware/rateLimit.middleware');

const router = Router();

// Public tracking (QR landing page) — no auth, rate limited
router.get('/public/:trackingNumber', trackingLimiter, c.publicTrack);

// Authenticated operational endpoints
router.use(requireAuth, internalOnly);
router.post('/ingest', c.ingest);
router.get('/live', c.liveFleet);
router.get('/trail/:vehicleId', c.trail);
router.get('/playback', c.playback);

module.exports = router;
