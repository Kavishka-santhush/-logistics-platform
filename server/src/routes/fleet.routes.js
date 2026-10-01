const { Router } = require('express');
const c = require('../controllers/fleet.controller');
const { requireAuth } = require('../middleware/auth.middleware');
const { requireRoles, internalOnly } = require('../middleware/role.middleware');

const router = Router();
router.use(requireAuth, internalOnly);

router.get('/overview', c.overview);
router.get('/cost-summary', requireRoles('ORG_ADMIN', 'OPS_MANAGER', 'FINANCE_MANAGER'), c.costSummary);

module.exports = router;
