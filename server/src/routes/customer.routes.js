const { Router } = require('express');
const c = require('../controllers/customer.controller');
const { requireAuth } = require('../middleware/auth.middleware');
const { requireRoles, internalOnly } = require('../middleware/role.middleware');

const router = Router();
router.use(requireAuth, internalOnly);

const manage = requireRoles('ORG_ADMIN', 'OPS_MANAGER', 'DISPATCHER');

router.get('/', c.list);
router.get('/search', c.search);
router.get('/stats', c.stats);
router.get('/:id', c.get);
router.post('/', manage, c.create);
router.patch('/:id', manage, c.update);
router.post('/:id/archive', requireRoles('ORG_ADMIN'), c.archive);

router.get('/:id/addresses', c.listAddresses);
router.post('/:id/addresses', manage, c.addAddress);
router.delete('/:id/addresses/:addressId', manage, c.removeAddress);

router.get('/:id/contracts', c.listContracts);
router.post('/:id/contracts', requireRoles('ORG_ADMIN', 'FINANCE_MANAGER'), c.addContract);

router.get('/:id/performance', c.performance);
router.get('/:id/trend', c.orderTrend);

module.exports = router;
