const { Router } = require('express');
const c = require('../controllers/warehouse.controller');
const { requireAuth } = require('../middleware/auth.middleware');
const { requireRoles, internalOnly } = require('../middleware/role.middleware');

const router = Router();
router.use(requireAuth, internalOnly);

const wh = requireRoles('ORG_ADMIN', 'WAREHOUSE_MANAGER', 'OPS_MANAGER');

router.get('/', c.list);
router.get('/:id', c.get);
router.post('/', wh, c.create);
router.patch('/:id', wh, c.update);
router.delete('/:id', requireRoles('ORG_ADMIN'), c.remove);
router.post('/:id/zones', wh, c.addZone);
router.post('/:id/inbound', wh, c.receiveInbound);
router.post('/:id/cross-dock', wh, c.crossDock);
router.get('/:id/performance', wh, c.performance);

module.exports = router;
