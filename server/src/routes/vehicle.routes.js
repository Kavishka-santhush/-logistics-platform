const { Router } = require('express');
const c = require('../controllers/vehicle.controller');
const { requireAuth } = require('../middleware/auth.middleware');
const { requireRoles, internalOnly } = require('../middleware/role.middleware');

const router = Router();
router.use(requireAuth, internalOnly);

const manage = requireRoles('ORG_ADMIN', 'OPS_MANAGER');

router.get('/', c.list);
router.get('/utilization', c.utilization);
router.get('/:id', c.get);
router.post('/', manage, c.create);
router.patch('/:id', manage, c.update);
router.delete('/:id', requireRoles('ORG_ADMIN'), c.remove);
router.post('/:id/status', manage, c.setStatus);
router.post('/:id/assign', manage, c.assign);
router.post('/:id/telematics', c.recordTelematics);
router.get('/:id/cost-of-ownership', requireRoles('ORG_ADMIN', 'OPS_MANAGER', 'FINANCE_MANAGER'), c.costOfOwnership);

module.exports = router;
