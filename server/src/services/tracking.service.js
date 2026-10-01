const prisma = require('../lib/prisma');
const { haversineKm, bearing } = require('../utils/haversine.util');
const geofenceService = require('./geofence.service');
const { notFound, forbidden } = require('../utils/response.util');

// In-memory last-known telemetry for idle + speed + geofence-transition detection.
const lastState = new Map(); // vehicleId -> { ts, lat, lng, moving, insideFences:Set }

/**
 * Persist a GPS point and derive live alerts (overspeed / idle / geofence).
 * Returns { position, alerts }.
 */
async function ingestPoint(input) {
  const {
    organizationId,
    vehicleId,
    driverId,
    orderId,
    lat,
    lng,
    speedKmh = null,
    heading = null,
    engineOn = null,
    odometerKm = null,
  } = input;

  if (Number.isNaN(lat) || Number.isNaN(lng)) throw forbidden('Invalid coordinates');

  const vehicle = await prisma.vehicle.findFirst({
    where: { id: vehicleId, organizationId },
    select: { id: true, plateNumber: true, gpsDeviceId: true, assignedDriverId: true },
  });
  if (!vehicle) throw notFound('Vehicle not found for this organization');

  // A driver may only report for the vehicle assigned to them
  if (driverId && vehicle.assignedDriverId && vehicle.assignedDriverId !== driverId) {
    throw forbidden('Vehicle not assigned to this driver');
  }

  const point = await prisma.trackingPoint.create({
    data: {
      organizationId,
      vehicleId,
      driverId: driverId || vehicle.assignedDriverId,
      orderId,
      latitude: lat,
      longitude: lng,
      speedKmh,
      heading,
      engineOn,
      odometerKm,
    },
  });

  const prev = lastState.get(vehicleId);
  const recordedAt = point.recordedAt.toISOString();
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { speedLimitKmh: true, idleAlertMins: true },
  });

  const alerts = [];
  const now = Date.now();

  // 1. Overspeed
  if (speedKmh != null && org?.speedLimitKmh && speedKmh > org.speedLimitKmh) {
    alerts.push({
      kind: 'SPEED_VIOLATION',
      vehicleId,
      plateNumber: vehicle.plateNumber,
      speedKmh,
      limit: org.speedLimitKmh,
      lat,
      lng,
      at: recordedAt,
    });
  }

  // 2. Idle (engine on, not moving, too long)
  const moving = speedKmh != null ? speedKmh > 3 : prev ? haversineKm(prev, { lat, lng }) > 0.05 : true;
  if (!moving && engineOn && prev?.idleSince) {
    const idleMins = (now - prev.idleSince) / 60000;
    if (idleMins >= (org?.idleAlertMins || 15) && !prev.idleAlerted) {
      alerts.push({ kind: 'IDLE_ALERT', vehicleId, plateNumber: vehicle.plateNumber, idleMins: Math.round(idleMins), at: recordedAt });
      prev.idleAlerted = true;
    }
  }

  // 3. Geofence enter/exit transitions
  const fence = await geofenceService.evaluatePoint(organizationId, { vehicleId, plateNumber: vehicle.plateNumber, lat, lng }, prev?.insideFences);
  alerts.push(...(fence.alerts || []));

  lastState.set(vehicleId, {
    ts: now,
    lat,
    lng,
    moving,
    idleSince: !moving ? prev?.idleSince || now : null,
    idleAlerted: !moving ? prev?.idleAlerted || false : false,
    insideFences: fence.insideSet || prev?.insideFences || new Set(),
    heading: heading ?? (prev ? bearing(prev, { lat, lng }) : null),
  });

  // Keep latest telematics snapshot on the vehicle row for fast map rendering
  await prisma.vehicle.update({
    where: { id: vehicleId },
    data: {
      telematics: {
        speedKmh,
        engineOn,
        lat,
        lng,
        heading: heading ?? null,
        odometerKm,
        updatedAt: recordedAt,
      },
      ...(odometerKm != null ? { odometerKm } : {}),
    },
  });

  return {
    position: {
      vehicleId,
      plateNumber: vehicle.plateNumber,
      lat,
      lng,
      speedKmh,
      heading: heading ?? null,
      engineOn,
      odometerKm,
      orderId,
      recordedAt,
    },
    alerts,
  };
}

/** Latest known position per vehicle in the org (for the live ops map). */
async function liveFleet(organizationId) {
  const vehicles = await prisma.vehicle.findMany({
    where: { organizationId, status: { notIn: ['RETIRED', 'OUT_OF_SERVICE'] } },
    select: {
      id: true,
      plateNumber: true,
      type: true,
      status: true,
      telematics: true,
      assignedDriver: { select: { id: true, name: true } },
    },
  });
  return vehicles
    .filter((v) => v.telematics?.lat != null)
    .map((v) => ({
      vehicleId: v.id,
      plateNumber: v.plateNumber,
      type: v.type,
      status: v.status,
      driver: v.assignedDriver,
      lat: Number(v.telematics.lat),
      lng: Number(v.telematics.lng),
      speedKmh: v.telematics.speedKmh,
      heading: v.telematics.heading,
      updatedAt: v.telematics.updatedAt,
    }));
}

/** Ordered trail for a vehicle within a time window (polyline). */
async function trail(organizationId, vehicleId, { from, to, limit = 5000 } = {}) {
  const where = { organizationId, vehicleId };
  if (from || to) where.recordedAt = { ...(from && { gte: new Date(from) }), ...(to && { lte: new Date(to) }) };
  const points = await prisma.trackingPoint.findMany({ where, orderBy: { recordedAt: 'asc' }, take: limit });
  return points.map((p) => ({
    lat: Number(p.latitude),
    lng: Number(p.longitude),
    speed: p.speedKmh != null ? Number(p.speedKmh) : null,
    at: p.recordedAt.toISOString(),
  }));
}

/** Historical route playback data for a single trip/order. */
async function playback(organizationId, { vehicleId, orderId, from, to }) {
  const where = { organizationId };
  if (vehicleId) where.vehicleId = vehicleId;
  if (orderId) where.orderId = orderId;
  if (from || to) where.recordedAt = { ...(from && { gte: new Date(from) }), ...(to && { lte: new Date(to) }) };
  const points = await prisma.trackingPoint.findMany({ where, orderBy: { recordedAt: 'asc' }, take: 20000 });
  const coords = points.map((p) => ({ lat: Number(p.latitude), lng: Number(p.longitude), at: p.recordedAt.getTime(), speed: p.speedKmh != null ? Number(p.speedKmh) : null }));
  let totalKm = 0;
  for (let i = 1; i < coords.length; i++) totalKm += haversineKm(coords[i - 1], coords[i]);
  return { coords, totalKm: Number(totalKm.toFixed(2)), startedAt: coords[0]?.at, endedAt: coords.at(-1)?.at };
}

/** Public tracking lookup by tracking number (no auth). Returns customer-safe view. */
async function publicTrack(trackingNumber) {
  const order = await prisma.order.findUnique({
    where: { trackingNumber },
    include: {
      events: { orderBy: { createdAt: 'asc' } },
      assignedDriver: { select: { name: true, photoUrl: true } },
      assignedVehicle: { select: { plateNumber: true, telematics: true } },
      packages: { select: { barcode: true, type: true, status: true } },
      proofs: { orderBy: { capturedAt: 'desc' }, take: 1 },
      rating: true,
    },
  });
  if (!order) return null;

  const telematics = order.assignedVehicle?.telematics;
  return {
    trackingNumber: order.trackingNumber,
    orderNumber: order.orderNumber,
    status: order.status,
    priority: order.priority,
    type: order.type,
    createdAt: order.createdAt,
    promisedAt: order.promisedAt,
    deliveredAt: order.deliveredAt,
    failedReason: order.failedReason,
    isLate: order.isLate,
    originCity: order.pickupCity,
    destinationCity: order.deliveryCity,
    deliveryAddress: order.status === 'DELIVERED' ? order.deliveryAddressLine : undefined,
    etaAt: telematics?.etaAt || order.scheduledDeliveryAt,
    driver: order.assignedDriver ? { name: order.assignedDriver.name, photoUrl: order.assignedDriver.photoUrl } : null,
    vehicle: order.assignedVehicle ? { plateNumber: order.assignedVehicle.plateNumber } : null,
    livePosition: telematics?.lat != null ? { lat: Number(telematics.lat), lng: Number(telematics.lng), updatedAt: telematics.updatedAt } : null,
    timeline: order.events.map((e) => ({ status: e.status, at: e.createdAt, note: e.note })),
    packages: order.packages,
    proof: order.proofs[0]
      ? { signatureUrl: order.proofs[0].signatureUrl, photoUrls: order.proofs[0].photoUrls, capturedAt: order.proofs[0].capturedAt }
      : null,
    rated: Boolean(order.rating),
  };
}

module.exports = { ingestPoint, liveFleet, trail, playback, publicTrack };
