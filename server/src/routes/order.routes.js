const { Router } = require('express');
const c = require('../controllers/order.controller');
const { requireAuth } = require('../middleware/auth.middleware');
const { requireRoles, internalOnly } = require('../middleware/role.middleware');

const router = Router();
router.use(requireAuth);

const ops = requireRoles('ORG_ADMIN', 'OPS_MANAGER', 'DISPATCHER');

router.get('/', internalOnly, c.list);
router.get('/search', internalOnly, c.search);
router.get('/:id', c.get); // customers may read their own order via service scoping downstream
router.post('/', internalOnly, ops, c.create);
router.post('/:id/status', internalOnly, c.updateStatus);
router.post('/:id/pod', internalOnly, c.recordPod);
router.post('/:id/reschedule', internalOnly, ops, c.reschedule);
router.post('/:id/return', internalOnly, ops, c.createReturn);
router.post('/:id/clone', internalOnly, ops, c.clone);
router.post('/:id/reconcile-cod', internalOnly, requireRoles('ORG_ADMIN', 'FINANCE_MANAGER'), c.reconcileCod);

module.exports = router;
