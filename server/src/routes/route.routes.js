const { Router } = require('express');
const c = require('../controllers/route.controller');
const { requireAuth } = require('../middleware/auth.middleware');
const { requireRoles, internalOnly } = require('../middleware/role.middleware');

const router = Router();
router.use(requireAuth, internalOnly);

const plan = requireRoles('ORG_ADMIN', 'OPS_MANAGER', 'DISPATCHER');

router.get('/', c.list);
router.get('/templates', c.listTemplates);
router.post('/templates', plan, c.saveTemplate);
router.delete('/templates/:id', plan, c.removeTemplate);

router.get('/:id', c.get);
router.post('/', plan, c.create);
router.patch('/:id', plan, c.update);
router.delete('/:id', plan, c.remove);
router.post('/:id/assign', plan, c.assign);
router.post('/:id/start', c.start);
router.post('/:id/complete', c.complete);
router.post('/:id/reroute', plan, c.reroute);
router.post('/stops/:stopId', c.updateStop);

module.exports = router;
