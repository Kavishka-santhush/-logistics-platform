const logger = require('../utils/logger.util');
const dispatchService = require('../services/dispatch.service');
const notificationService = require('../services/notification.service');

/**
 * Dispatch board realtime: driver assignment responses, stop status changes,
 * driver→dispatcher messages, and emergency SOS.
 */
function registerDispatch(io, socket) {
  // Driver accepts or rejects an assignment
  socket.on('dispatch:respond', async ({ dispatchId, action, reason }) => {
    try {
      const u = socket.data.user;
      if (!u || u.role !== 'DRIVER') return socket.emit('dispatch:error', { message: 'Drivers only' });
      const result = await dispatchService.respond({
        dispatchId,
        driverId: u.driverId,
        action, // 'accept' | 'reject'
        reason,
      });
      io.to(`org:${result.organizationId}`).emit('dispatch:updated', result);
      socket.emit('dispatch:respond:ack', { ok: true, dispatchId });
    } catch (err) {
      logger.warn('dispatch:respond failed', err);
      socket.emit('dispatch:error', { message: err.message });
    }
  });

  // Emergency SOS from driver — relayed instantly to the org ops room
  socket.on('driver:sos', async (payload = {}) => {
    const u = socket.data.user;
    if (!u || u.role !== 'DRIVER' || !u.driverId) return;
    io.to(`org:${u.organizationId}`).emit('driver:sos', {
      driverId: u.driverId,
      lat: payload.lat,
      lng: payload.lng,
      orderId: payload.orderId,
      at: new Date().toISOString(),
    });
    await notificationService
      .broadcastToOrgRole(u.organizationId, 'OPS_MANAGER', {
        type: 'DRIVER_SOS',
        title: 'Driver emergency',
        body: `Driver sent an SOS${payload.locationText ? ` at ${payload.locationText}` : ''}`,
        payload: { driverId: u.driverId, lat: payload.lat, lng: payload.lng },
      })
      .catch((e) => logger.warn('sos notify failed', e.message));
  });

  // Dispatcher → driver message
  socket.on('message:send', async ({ driverId, body, orderId }) => {
    const u = socket.data.user;
    if (!u || !driverId || !body) return;
    const msg = await dispatchService
      .sendDriverMessage({ organizationId: u.organizationId, senderId: u.id, driverId, body, orderId })
      .catch((err) => {
        socket.emit('message:error', { message: err.message });
        return null;
      });
    if (msg) io.to(`driver:${driverId}`).emit('message:received', msg);
    socket.emit('message:sent:ack', { ok: true, id: msg?.id });
  });

  // Driver replies to dispatcher
  socket.on('message:reply', async ({ body, orderId }) => {
    const u = socket.data.user;
    if (!u || u.role !== 'DRIVER' || !body) return;
    const msg = await dispatchService
      .sendDriverReply({ driverId: u.driverId, body, orderId })
      .catch(() => null);
    if (msg) io.to(`org:${u.organizationId}`).emit('message:received:driver', msg);
  });
}

module.exports = registerDispatch;
