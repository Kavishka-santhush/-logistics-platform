const { Router } = require('express');
const c = require('../controllers/organization.controller');
const { requireAuth } = require('../middleware/auth.middleware');
const { requireRoles } = require('../middleware/role.middleware');

const router = Router();

// Plans are public reference data
router.get('/plans', c.listPlans);
router.get('/plans/:tier', c.getPlan);

// Super-admin cross-org listing / provisioning
router.get('/', requireAuth, requireRoles('SUPER_ADMIN'), c.listAll);
router.post('/', requireAuth, requireRoles('SUPER_ADMIN'), c.create);

// Current organization
router.get('/current', requireAuth, c.get);
router.patch('/current', requireAuth, requireRoles('ORG_ADMIN'), c.update);
router.post('/subscription', requireAuth, requireRoles('ORG_ADMIN'), c.setSubscription);

// Branches
router.get('/branches', requireAuth, c.listBranches);
router.post('/branches', requireAuth, requireRoles('ORG_ADMIN', 'OPS_MANAGER'), c.createBranch);
router.patch('/branches/:id', requireAuth, requireRoles('ORG_ADMIN', 'OPS_MANAGER'), c.updateBranch);
router.delete('/branches/:id', requireAuth, requireRoles('ORG_ADMIN'), c.removeBranch);

module.exports = router;
