const { Router } = require('express');
const c = require('../controllers/driver.controller');
const { requireAuth } = require('../middleware/auth.middleware');
const { requireRoles, internalOnly } = require('../middleware/role.middleware');

const router = Router();
router.use(requireAuth, internalOnly);

const manage = requireRoles('ORG_ADMIN', 'OPS_MANAGER');

router.get('/', c.list);
router.get('/me', c.me);
router.get('/:id', c.get);
router.post('/', manage, c.create);
router.patch('/:id', manage, c.update);
router.delete('/:id', requireRoles('ORG_ADMIN'), c.remove);
router.post('/:id/status', manage, c.setStatus);
router.post('/:id/suspend', manage, c.setSuspended);
router.post('/:id/reset-pin', manage, c.resetPin);
router.get('/:id/performance', c.performance);

router.post('/:id/leave', c.requestLeave);
router.patch('/leave/:leaveId/approve', manage, c.approveLeave);
router.post('/:id/shifts', manage, c.setShifts);
router.post('/:id/driving-minutes', c.addDrivingMinutes);

module.exports = router;
