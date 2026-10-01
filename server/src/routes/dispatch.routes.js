const { Router } = require('express');
const c = require('../controllers/dispatch.controller');
const { requireAuth } = require('../middleware/auth.middleware');
const { requireRoles, internalOnly } = require('../middleware/role.middleware');

const router = Router();
router.use(requireAuth, internalOnly);

const dispatchers = requireRoles('ORG_ADMIN', 'OPS_MANAGER', 'DISPATCHER');

router.get('/board', c.board);
router.get('/day-summary', c.daySummary);
router.post('/assign', dispatchers, c.assign);
router.post('/bulk-assign', dispatchers, c.bulkAssign);
router.get('/drivers/:driverId/conversation', c.conversation);
router.get('/drivers/:driverId/pending', requireRoles('DRIVER'), c.pendingForMe);
router.post('/drivers/:driverId/message', dispatchers, c.sendMessage);
router.post('/drivers/:driverId/message/reply', requireRoles('DRIVER'), c.sendReply);

module.exports = router;
