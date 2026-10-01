const { Router } = require('express');
const c = require('../controllers/notification.controller');
const { requireAuth } = require('../middleware/auth.middleware');

const router = Router();
router.use(requireAuth);

router.get('/', c.list);
router.get('/unread-count', c.unreadCount);
router.post('/read-all', c.markAllRead);
router.patch('/:id/read', c.markRead);

router.get('/preferences', c.getPreferences);
router.put('/preferences', c.setPreference);

module.exports = router;
