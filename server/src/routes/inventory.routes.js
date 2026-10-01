const { Router } = require('express');
const c = require('../controllers/inventory.controller');
const { requireAuth } = require('../middleware/auth.middleware');
const { requireRoles, internalOnly } = require('../middleware/role.middleware');

const router = Router();
router.use(requireAuth, internalOnly);

const wh = requireRoles('ORG_ADMIN', 'WAREHOUSE_MANAGER', 'OPS_MANAGER');

router.get('/', c.list);
router.get('/search', c.search);
router.get('/low-stock', c.lowStock);
router.get('/scan/:code', c.scan);
router.get('/:id', c.get);
router.post('/', wh, c.create);
router.patch('/:id', wh, c.update);
router.delete('/:id', requireRoles('ORG_ADMIN'), c.remove);
router.post('/move', wh, c.move);
router.post('/adjust', wh, c.adjust);
router.post('/transfer', wh, c.transfer);
router.post('/tasks', wh, c.createTask);
router.patch('/tasks/:id', wh, c.updateTask);

module.exports = router;
