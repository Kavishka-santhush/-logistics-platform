const logger = require('../utils/logger.util');
const trackingService = require('../services/tracking.service');

/**
 * Live GPS ingestion from the driver mobile app.
 * Contract (client → server): { trackingNumber?, vehicleId, lat, lng, speed?, heading?, engineOn?, odometer? }
 * Server persists the point, runs geofence/speed/idle checks, and broadcasts to
 * the org room (ops map) + any subscribed public tracking viewers.
 */
function registerTracking(io, socket) {
  socket.on('gps:update', async (payload) => {
    try {
      const u = socket.data.user;
      if (!u || !vehicleAccessAllowed(u, payload)) {
        return socket.emit('gps:error', { message: 'Not authorized for this vehicle' });
      }
      const result = await trackingService.ingestPoint({
        organizationId: u.organizationId,
        vehicleId: payload.vehicleId,
        driverId: u.driverId || payload.driverId,
        orderId: payload.orderId,
        lat: Number(payload.lat),
        lng: Number(payload.lng),
        speedKmh: payload.speed != null ? Number(payload.speed) : null,
        heading: payload.heading != null ? Number(payload.heading) : null,
        engineOn: payload.engineOn,
        odometerKm: payload.odometer != null ? Number(payload.odometer) : null,
      });

      // Broadcast live position to the operations dashboard for this org
      io.to(`org:${u.organizationId}`).emit('vehicle:position', result.position);
      // Broadcast to public tracking viewers watching this order
      if (result.position.trackingNumber) {
        io.to(`track:${result.position.trackingNumber}`).emit('shipment:position', {
          lat: result.position.lat,
          lng: result.position.lng,
          speed: result.position.speedKmh,
          heading: result.position.heading,
          updatedAt: result.position.recordedAt,
        });
      }
      // Surface any alerts (overspeed / geofence / idle) raised during ingest
      for (const alert of result.alerts || []) {
        io.to(`org:${u.organizationId}`).emit('alert', alert);
      }
      socket.emit('gps:ack', { ok: true, ts: Date.now() });
    } catch (err) {
      logger.warn('gps:update failed', err);
      socket.emit('gps:error', { message: err.message });
    }
  });
}

// Drivers may only transmit for their assigned vehicle; staff for any org vehicle.
function vehicleAccessAllowed(user, payload) {
  if (!payload?.vehicleId) return false;
  if (user.role === 'DRIVER') return true; // validated against assignment inside the service
  return Boolean(user.organizationId);
}

module.exports = registerTracking;
