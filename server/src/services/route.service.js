const prisma = require('../lib/prisma');
const { crud } = require('../lib/crud');
const { notFound, badRequest } = require('../utils/response.util');
const optimizer = require('./routeOptimizer.service');
const { emitToOrg } = require('../socket');

const base = crud('route');
const list = (orgId, opts) => base.list(orgId, opts);
const remove = (orgId, id) => base.remove(orgId, id);

async function get(orgId, id) {
  const route = await prisma.route.findFirst({
    where: { id, organizationId: orgId },
    include: { stops: { orderBy: { sequence: 'asc' }, include: { order: { select: { orderNumber: true, trackingNumber: true, status: true, deliveryAddressLine: true, totalWeightKg: true } } } }, driver: { select: { name: true, phone: true } }, vehicle: { select: { plateNumber: true, type: true } } },
  });
  if (!route) throw notFound('Route');
  return route;
}

/** Create a route from a manual or optimized stop list. */
async function create(orgId, data, { plannedBy } = {}) {
  const stops = data.stops || [];
  if (!stops.length) throw badRequest('Route needs at least one stop');

  let ordered = stops;
  let metrics = { totalDistanceKm: data.totalDistanceKm, totalDurationMin: data.totalDurationMin };

  if (data.optimize) {
    const vehicle = data.vehicleId ? await prisma.vehicle.findFirst({ where: { id: data.vehicleId, organizationId: orgId } }) : null;
    const start = data.startPoint || { lat: stops[0].latitude, lng: stops[0].longitude };
    const res = await optimizer.optimizeStops({
      stops: stops.map((s) => ({ ...s, lat: Number(s.latitude), lng: Number(s.longitude) })),
      start,
      vehicle,
      opts: { avoidTolls: data.avoidTolls, useAi: data.useAi },
      meta: { organizationId, userId: plannedBy },
    });
    ordered = res.ordered;
    metrics = res.metrics;
  }

  const route = await prisma.route.create({
    data: {
      organizationId,
      name: data.name,
      date: new Date(data.date || Date.now()),
      status: 'PLANNED',
      plannedBy,
      templateId: data.templateId || null,
      waypoints: ordered,
      totalDistanceKm: metrics?.totalDistanceKm,
      totalDurationMin: metrics?.totalDurationMin,
      isOptimized: !!data.optimize,
      optimizationData: metrics,
      stops: {
        create: ordered.map((s, i) => ({
          orderId: s.orderId,
          sequence: i + 1,
          addressLine: s.addressLine,
          latitude: s.lat ?? s.latitude,
          longitude: s.lng ?? s.longitude,
          windowStart: s.windowStart ? new Date(s.windowStart) : null,
          windowEnd: s.windowEnd ? new Date(s.windowEnd) : null,
          etaAt: s.etaMinutes ? new Date(Date.now() + s.etaMinutes * 60000) : null,
          distanceFromPrevKm: s.distanceFromPrevKm,
        })),
      },
    },
    include: { stops: true },
  });

  // capacity check
  const vehicle = data.vehicleId ? await prisma.vehicle.findFirst({ where: { id: data.vehicleId } }) : null;
  const cap = optimizer.capacityCheck(ordered.map((s) => ({ weightKg: s.weightKg, volumeM3: s.volumeM3 })), vehicle);

  emitToOrg(orgId, 'route:created', { id: route.id, name: route.name });
  return { ...route, capacity: cap };
}

async function update(orgId, id, data) {
  await ensure(orgId, id);
  return prisma.route.update({ where: { id }, data: { name: data.name, date: data.date ? new Date(data.date) : undefined, waypoints: data.waypoints } });
}

/** Assign a route to a driver + vehicle, linking all its orders. */
async function assign(orgId, id, { driverId, vehicleId, dispatchedBy }) {
  const route = await ensure(orgId, id);
  if (route.status !== 'PLANNED') throw badRequest('Only planned routes can be assigned');
  const [driver, vehicle] = await Promise.all([
    prisma.driver.findFirst({ where: { id: driverId, organizationId: orgId } }),
    prisma.vehicle.findFirst({ where: { id: vehicleId, organizationId: orgId } }),
  ]);
  if (!driver) throw notFound('Driver');
  if (!vehicle) throw notFound('Vehicle');

  const updated = await prisma.route.update({
    where: { id },
    data: { driverId, vehicleId, status: 'ASSIGNED' },
  });
  await prisma.order.updateMany({ where: { routeId: id }, data: { assignedDriverId: driverId, assignedVehicleId: vehicleId, status: 'ASSIGNED' } });
  await prisma.dispatch.create({ data: { organizationId: orgId, routeId: id, driverId, vehicleId, mode: 'FULL_ROUTE', createdBy: dispatchedBy } });

  if (driver.userId) {
    require('./notification.service').notifyUser({
      userId: driver.userId, organizationId: orgId, type: 'ASSIGNMENT',
      title: 'New route assigned', body: `Route ${route.name} with ${route.stops?.length || ''} stops`,
      payload: { routeId: id }, forcePush: true,
    }).catch(() => {});
  }
  emitToOrg(orgId, 'route:updated', { id, status: 'ASSIGNED' });
  return updated;
}

async function start(orgId, id) {
  await ensure(orgId, id);
  const r = await prisma.route.update({ where: { id }, data: { status: 'IN_PROGRESS', startedAt: new Date() } });
  await prisma.order.updateMany({ where: { routeId: id }, data: { status: 'IN_TRANSIT' } });
  return r;
}

async function complete(orgId, id) {
  await ensure(orgId, id);
  return prisma.route.update({ where: { id }, data: { status: 'COMPLETED', completedAt: new Date() } });
}

/** Update an individual stop's status as the driver works the route. */
async function updateStop(orgId, stopId, { status, lat, lng }) {
  const stop = await prisma.routeStop.findFirst({ where: { id: stopId, route: { organizationId: orgId } }, include: { route: true } });
  if (!stop) throw notFound('Route stop');
  const data = { status };
  if (status === 'ARRIVED') data.arrivedAt = new Date();
  if (status === 'COMPLETED') data.completedAt = new Date();
  const updated = await prisma.routeStop.update({ where: { id: stopId }, data });
  // Advance order status with the stop
  const map = { ARRIVED: 'OUT_FOR_DELIVERY', COMPLETED: 'DELIVERED', FAILED: 'FAILED' };
  if (map[status]) await prisma.order.update({ where: { id: stop.orderId }, data: { status: map[status] } }).catch(() => {});
  return updated;
}

/** Re-plan ETA/distance for a route (dynamic re-routing). */
async function reroute(orgId, id) {
  const route = await get(orgId, id);
  const pending = route.stops.filter((s) => !['COMPLETED', 'SKIPPED'].includes(s.status));
  const start = route.vehicle?.telematics?.lat != null ? { lat: Number(route.vehicle.telematics.lat), lng: Number(route.vehicle.telematics.lng) } : { lat: Number(pending[0].latitude), lng: Number(pending[0].longitude) };
  const res = await optimizer.optimizeStops({ stops: pending.map((s) => ({ orderId: s.orderId, lat: Number(s.latitude), lng: Number(s.longitude), addressLine: s.addressLine, weightKg: s.order?.totalWeightKg })), start, vehicle: route.vehicleId ? { weightCapacityKg: 0 } : null, opts: {} });
  let acc = Date.now();
  await prisma.$transaction(
    (res.ordered || []).map((s, i) => prisma.routeStop.update({ where: { id: pending.find((p) => p.orderId === s.orderId)?.id }, data: { sequence: i + 1, etaAt: s.etaMinutes ? new Date(acc) : undefined } }))
  );
  return res.metrics;
}

// ── Templates ─────────────────────────────────────────────────────────────────
const templateCrud = crud('routeTemplate');
const listTemplates = (orgId, opts) => templateCrud.list(orgId, opts);
const saveTemplate = (orgId, { name, waypoints, distanceKm }) => prisma.routeTemplate.create({ data: { organizationId: orgId, name, waypoints, distanceKm } });
const removeTemplate = (orgId, id) => templateCrud.remove(orgId, id);

async function ensure(orgId, id) {
  const r = await prisma.route.findFirst({ where: { id, organizationId: orgId }, include: { stops: true, vehicle: true } });
  if (!r) throw notFound('Route');
  return r;
}

module.exports = { list, get, create, update, remove, assign, start, complete, updateStop, reroute, listTemplates, saveTemplate, removeTemplate };
