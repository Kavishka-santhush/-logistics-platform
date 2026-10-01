const svc = require('../services/notification.service');
const { h } = require('../utils/asyncHandler.util');
const { ok, paginated } = require('../utils/response.util');

const list = h(async (req, res) => { const r = await svc.list(req.userId, { ...req.query, unreadOnly: req.query.unreadOnly === 'true' }); res.json(paginated(r.data, r)); });
const unreadCount = h(async (req, res) => res.json(ok({ unread: await svc.unreadCount(req.userId) })));
const markRead = h(async (req, res) => { await svc.markRead({ id: req.params.id, userId: req.userId }); res.json(ok({ read: true })); });
const markAllRead = h(async (req, res) => { await svc.markAllRead(req.userId); res.json(ok({ read: true })); });

const getPreferences = h(async (req, res) => res.json(ok(await svc.getPreferences(req.userId))));
const setPreference = h(async (req, res) => res.json(ok(await svc.setPreference({ userId: req.userId, ...req.body }))));

module.exports = { list, unreadCount, markRead, markAllRead, getPreferences, setPreference };
