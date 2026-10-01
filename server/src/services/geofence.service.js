const prisma = require('../lib/prisma');
const { isInside } = require('../utils/geofence.util');
const { crud } = require('../lib/crud');
const { notFound } = require('../utils/response.util');

const base = crud('geofence');

const list = (orgId, opts) => base.list(orgId, opts);
const get = (orgId, id) => base.byId(orgId, id).then((r) => r || Promise.reject(notFound('Geofence')));
const create = (orgId, data) => base.create(orgId, data);
const update = (orgId, id, data) => base.update(orgId, id, data);
const remove = (orgId, id) => base.remove(orgId, id);

/**
 * Evaluate a vehicle point against all active geofences for the org.
 * Emits enter/exit events when containment changes vs. the previous inside set.
 * Returns an array of alert objects (also persisted as GeofenceAlert rows).
 */
async function evaluatePoint(organizationId, vehicle, prevInside) {
  const fences = await prisma.geofence.findMany({ where: { organizationId, isActive: true } });
  if (!fences.length) return { alerts: [], insideSet: new Set() };

  const nowInside = new Set();
  const alerts = [];

  for (const f of fences) {
    const inside = isInside({ lat: vehicle.lat, lng: vehicle.lng }, f);
    if (inside) nowInside.add(f.id);
    const wasInside = prevInside ? prevInside.has(f.id) : inside;
    // On first observation (prevInside undefined) don't spam historical events
    if (prevInside) {
      const alertOn = f.alertOn || { enter: true, exit: true };
      if (!wasInside && inside && alertOn.enter !== false) {
        alerts.push({ kind: 'GEOFENCE_BREACH', event: 'enter', geofenceId: f.id, name: f.name, ...vehicle });
        await prisma.geofenceAlert.create({ data: { geofenceId: f.id, vehicleId: vehicle.vehicleId, eventType: 'enter', latitude: vehicle.lat, longitude: vehicle.lng } });
      } else if (wasInside && !inside && alertOn.exit !== false) {
        alerts.push({ kind: 'GEOFENCE_BREACH', event: 'exit', geofenceId: f.id, name: f.name, ...vehicle });
        await prisma.geofenceAlert.create({ data: { geofenceId: f.id, vehicleId: vehicle.vehicleId, eventType: 'exit', latitude: vehicle.lat, longitude: vehicle.lng } });
      }
    }
  }

  return { alerts, insideSet: nowInside };
}

/** Recent geofence activity for reports/dashboards. */
async function recentAlerts(organizationId, { from, limit = 200 } = {}) {
  return prisma.geofenceAlert.findMany({
    where: { geofence: { organizationId }, ...(from && { triggeredAt: { gte: new Date(from) } }) },
    orderBy: { triggeredAt: 'desc' },
    take: limit,
    include: { geofence: { select: { name: true } }, vehicle: { select: { plateNumber: true } } },
  });
}

module.exports = { list, get, create, update, remove, evaluatePoint, recentAlerts };
