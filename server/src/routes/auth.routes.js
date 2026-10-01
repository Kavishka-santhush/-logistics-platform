const { Router } = require('express');
const c = require('../controllers/auth.controller');
const { requireAuth } = require('../middleware/auth.middleware');
const { requireRoles } = require('../middleware/role.middleware');

const router = Router();

router.get('/me', requireAuth, c.me);
router.patch('/profile', requireAuth, c.updateProfile);
router.post('/push-token', requireAuth, c.setPushToken);
router.post('/join', requireAuth, c.joinOrganization);

router.get('/users', requireAuth, requireRoles('ORG_ADMIN', 'OPS_MANAGER'), c.listUsers);
router.post('/users/invite', requireAuth, requireRoles('ORG_ADMIN'), c.inviteUser);

module.exports = router;
