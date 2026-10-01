const { Router } = require('express');
const c = require('../controllers/maintenance.controller');
const { requireAuth } = require('../middleware/auth.middleware');
const { requireRoles, internalOnly } = require('../middleware/role.middleware');

const router = Router();
router.use(requireAuth, internalOnly);

const manage = requireRoles('ORG_ADMIN', 'OPS_MANAGER');

router.get('/', c.list);
router.get('/kpis', c.kpis);
router.get('/schedules', c.listSchedules);
router.get('/schedules/due', c.dueSchedules);
router.post('/schedules', manage, c.createSchedule);
router.get('/vendors', c.listVendors);
router.post('/vendors', manage, c.createVendor);
router.patch('/vendors/:id', manage, c.updateVendor);
router.get('/cost-by-vehicle', requireRoles('ORG_ADMIN', 'OPS_MANAGER', 'FINANCE_MANAGER'), c.costByVehicle);

router.get('/:id', c.get);
router.post('/', manage, c.createWorkOrder);
router.patch('/:id', manage, c.updateWorkOrder);
router.post('/:id/complete', manage, c.completeService);

module.exports = router;
