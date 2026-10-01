const { Router } = require('express');
const c = require('../controllers/shipment.controller');
const { requireAuth } = require('../middleware/auth.middleware');
const { internalOnly } = require('../middleware/role.middleware');

const router = Router();
router.use(requireAuth, internalOnly);

router.get('/:orderId', c.get);
router.post('/:orderId/status', c.updateStatus);
router.get('/:orderId/timeline', c.timeline);

module.exports = router;
