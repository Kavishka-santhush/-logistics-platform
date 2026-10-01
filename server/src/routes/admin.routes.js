const { Router } = require('express');
const c = require('../controllers/admin.controller');
const { requireAuth } = require('../middleware/auth.middleware');
const { requireRoles } = require('../middleware/role.middleware');

const router = Router();
// Every platform-admin endpoint requires a SUPER_ADMIN session
router.use(requireAuth, requireRoles('SUPER_ADMIN'));

router.get('/stats', c.platformStats);
router.get('/health', c.systemHealth);

router.get('/organizations', c.listOrganizations);
router.post('/organizations', c.createOrganization);
router.get('/organizations/:id', c.getOrganization);
router.patch('/organizations/:id', c.updateOrganization);
router.post('/organizations/:id/active', c.setActive);
router.post('/organizations/:id/subscription', c.setSubscription);

router.get('/plans', c.listPlans);
router.post('/plans', c.upsertPlan);

router.get('/users', c.listUsers);
router.patch('/users/:id/status', c.setUserStatus);
router.patch('/users/:id/role', c.setUserRole);

router.get('/audit-logs', c.auditLogs);

module.exports = router;
