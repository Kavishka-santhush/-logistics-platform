const logger = require('../utils/logger.util');
const notificationService = require('../services/notification.service');

/**
 * Notification realtime channel — mark-as-read receipts and live bell updates.
 * (Server → client pushes happen via the org/user rooms in index.socket.)
 */
function registerNotification(io, socket) {
  socket.on('notification:read', async (id) => {
    try {
      const u = socket.data.user;
      if (!u || !id) return;
      await notificationService.markRead({ id, userId: u.id });
      io.to(`user:${u.id}`).emit('notification:count', {
        unread: await notificationService.unreadCount(u.id),
      });
    } catch (err) {
      logger.warn('notification:read failed', err.message);
    }
  });

  socket.on('notification:readAll', async () => {
    const u = socket.data.user;
    if (!u) return;
    await notificationService.markAllRead(u.id);
    io.to(`user:${u.id}`).emit('notification:count', { unread: 0 });
  });

  // Send initial unread count on connect
  const u = socket.data.user;
  if (u) {
    notificationService
      .unreadCount(u.id)
      .then((unread) => socket.emit('notification:count', { unread }))
      .catch(() => {});
  }
}

module.exports = registerNotification;
