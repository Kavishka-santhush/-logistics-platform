const { Router } = require('express');
const c = require('../controllers/report.controller');
const { requireAuth } = require('../middleware/auth.middleware');
const { requireRoles, internalOnly } = require('../middleware/role.middleware');

const router = Router();
router.use(requireAuth, internalOnly);

const manage = requireRoles('ORG_ADMIN', 'OPS_MANAGER', 'FINANCE_MANAGER', 'COMPLIANCE_OFFICER');

router.get('/types', c.types);
router.get('/scheduled', c.listScheduled);
router.post('/scheduled', manage, c.createScheduled);
router.patch('/scheduled/:id', manage, c.updateScheduled);
router.delete('/scheduled/:id', manage, c.deleteScheduled);
router.post('/scheduled/:id/run', manage, c.runScheduled);

router.get('/generate/:type', c.generate);
router.post('/generate/:type', c.generate);

module.exports = router;
