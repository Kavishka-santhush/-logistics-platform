const prisma = require('../lib/prisma');
const { crud } = require('../lib/crud');
const { notFound, badRequest } = require('../utils/response.util');
const ids = require('../utils/ids.util');
const notificationService = require('./notification.service');

const woCrud = crud('maintenanceWorkOrder');
const vendorCrud = crud('maintenanceVendor');
const scheduleCrud = crud('maintenanceSchedule', { scopeKey: null });

// ── Schedules ─────────────────────────────────────────────────────────────────
async function createSchedule(orgId, data) {
  const vehicle = await prisma.vehicle.findFirst({ where: { id: data.vehicleId, organizationId: orgId } });
  if (!vehicle) throw notFound('Vehicle');
  const next = computeNextDue(data, Number(vehicle.odometerKm));
  return prisma.maintenanceSchedule.create({
    data: {
      vehicleId: data.vehicleId,
      type: data.type,
      trigger: data.trigger,
      kmInterval: data.kmInterval,
      hoursInterval: data.hoursInterval,
      daysInterval: data.daysInterval,
      lastDoneKm: data.lastDoneKm != null ? Number(data.lastDoneKm) : Number(vehicle.odometerKm),
      lastDoneAt: data.lastDoneAt ? new Date(data.lastDoneAt) : new Date(),
      nextDueKm: next.nextDueKm,
      nextDueAt: next.nextDueAt,
    },
  });
}

function computeNextDue(s, currentKm) {
  let nextDueKm = null;
  let nextDueAt = null;
  if (s.trigger === 'KM') {
    const base = s.lastDoneKm != null ? Number(s.lastDoneKm) : currentKm;
    nextDueKm = base + (s.kmInterval || 0);
  }
  if (s.trigger === 'CALENDAR' || s.daysInterval) {
    nextDueAt = new Date(Date.now() + (s.daysInterval || 0) * 864e5);
  }
  return { nextDueKm, nextDueAt };
}

const listSchedules = (orgId, opts) => prisma.maintenanceSchedule.findMany({ where: { vehicle: { organizationId: orgId } }, include: { vehicle: { select: { plateNumber: true } } }, ...opts });

/** Schedules that are due within N days or N km (for cron alerts). */
async function dueSchedules(orgId, { withinDays = 7, withinKm = 200 } = {}) {
  const soon = new Date(Date.now() + withinDays * 864e5);
  const vehicles = await prisma.vehicle.findMany({ where: { organizationId: orgId }, select: { id: true, plateNumber: true, odometerKm: true } });
  const odo = Object.fromEntries(vehicles.map((v) => [v.id, Number(v.odometerKm)]));
  const schedules = await prisma.maintenanceSchedule.findMany({ where: { vehicle: { organizationId: orgId }, isActive: true } });
  return schedules
    .map((s) => {
      const kmDue = s.nextDueKm != null && odo[s.vehicleId] >= Number(s.nextDueKm) - withinKm;
      const dateDue = s.nextDueAt != null && new Date(s.nextDueAt) <= soon;
      return { ...s, overdue: (s.nextDueKm != null && odo[s.vehicleId] > Number(s.nextDueKm)) || (s.nextDueAt && new Date(s.nextDueAt) < new Date()), due: kmDue || dateDue, currentOdo: odo[s.vehicleId] };
    })
    .filter((s) => s.due);
}

// ── Work orders ────────────────────────────────────────────────────────────────
const list = (orgId, opts) => woCrud.list(orgId, opts);
const get = (orgId, id) => woCrud.byId(orgId, id, { include: { vehicle: { select: { plateNumber: true, odometerKm: true } }, vendor: true, parts: true } }).then((r) => r || Promise.reject(notFound('Work order')));

async function createWorkOrder(orgId, data) {
  const vehicle = await prisma.vehicle.findFirst({ where: { id: data.vehicleId, organizationId: orgId } });
  if (!vehicle) throw notFound('Vehicle');
  const seq = await ids.nextSeq('maintenanceWorkOrder', 'number', orgId);
  return prisma.maintenanceWorkOrder.create({
    data: {
      organizationId,
      vehicleId: data.vehicleId,
      scheduleId: data.scheduleId || null,
      vendorId: data.vendorId || null,
      number: ids.workOrderNumber(seq),
      type: data.type,
      status: data.status || 'PLANNED',
      description: data.description,
      scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
      estimatedCost: data.estimatedCost,
      mileageAtService: data.mileageAtService != null ? Number(data.mileageAtService) : Number(vehicle.odometerKm),
    },
  });
}

async function updateWorkOrder(orgId, id, data) {
  const wo = await get(orgId, id);
  const update = { ...data };
  if (data.status === 'IN_PROGRESS') update.startedAt = new Date();
  if (data.status === 'COMPLETED') {
    update.completedAt = new Date();
    if (wo.startedAt) update.downtimeHours = Number(((Date.now() - new Date(wo.startedAt)) / 3600000).toFixed(2));
  }
  return prisma.maintenanceWorkOrder.update({ where: { id }, data: update });
}

/** Complete a service: record actual cost + parts, bump odometer, reschedule next. */
async function completeService(orgId, id, { actualCost, mileageAtService, parts = [], vendorId }) {
  const wo = await get(orgId, id);
  const vehicle = await prisma.vehicle.findFirst({ where: { id: wo.vehicleId } });
  await prisma.$transaction([
    prisma.maintenanceWorkOrder.update({ where: { id }, data: { status: 'COMPLETED', actualCost, completedAt: new Date(), mileageAtService: mileageAtService ?? wo.mileageAtService, downtimeHours: wo.startedAt ? Number(((Date.now() - new Date(wo.startedAt)) / 3600000).toFixed(2)) : wo.downtimeHours, vendorId: vendorId ?? undefined } }),
    prisma.maintenancePart.createMany({ data: parts.map((p) => ({ workOrderId: id, name: p.name, partNumber: p.partNumber, quantity: p.quantity || 1, unitCost: p.unitCost })) }),
    prisma.vehicle.update({ where: { id: wo.vehicleId }, data: { odometerKm: mileageAtService ?? vehicle.odometerKm, status: 'AVAILABLE' } }),
  ]);
  if (wo.scheduleId) {
    const s = await prisma.maintenanceSchedule.findUnique({ where: { id: wo.scheduleId } });
    if (s) {
      const next = computeNextDue(s, Number(mileageAtService ?? vehicle.odometerKm));
      await prisma.maintenanceSchedule.update({ where: { id: s.id }, data: { lastDoneAt: new Date(), lastDoneKm: mileageAtService ?? vehicle.odometerKm, nextDueAt: next.nextDueAt, nextDueKm: next.nextDueKm } });
    }
  }
  return get(orgId, id);
}

// ── Vendors ──────────────────────────────────────────────────────────────────
const listVendors = (orgId, opts) => vendorCrud.list(orgId, opts);
const createVendor = (orgId, data) => vendorCrud.create(orgId, data);
const updateVendor = (orgId, id, data) => vendorCrud.update(orgId, id, data);

// ── Analytics ────────────────────────────────────────────────────────────────
async function costByVehicle(orgId, { days = 365 } = {}) {
  const since = new Date(Date.now() - days * 864e5);
  const groups = await prisma.maintenanceWorkOrder.groupBy({ by: ['vehicleId'], where: { organizationId: orgId, status: 'COMPLETED', completedAt: { gte: since } }, _sum: { actualCost: true }, _count: { _all: true } });
  const vehicles = await prisma.vehicle.findMany({ where: { id: { in: groups.map((g) => g.vehicleId) } }, select: { id: true, plateNumber: true } });
  const vmap = Object.fromEntries(vehicles.map((v) => [v.id, v.plateNumber]));
  return groups.map((g) => ({ vehicleId: g.vehicleId, plateNumber: vmap[g.vehicleId], totalCost: Number(g._sum.actualCost || 0), jobs: g._count._all })).sort((a, b) => b.totalCost - a.totalCost);
}

async function kpis(orgId) {
  const [overdue, upcoming, inProgress, totalDowntime] = await Promise.all([
    dueSchedules(orgId, { withinDays: 0, withinKm: 0 }).then((s) => s.filter((x) => x.overdue).length),
    dueSchedules(orgId).then((s) => s.length),
    prisma.maintenanceWorkOrder.count({ where: { organizationId: orgId, status: 'IN_PROGRESS' } }),
    prisma.maintenanceWorkOrder.aggregate({ where: { organizationId: orgId }, _sum: { downtimeHours: true } }),
  ]);
  return { overdue, upcoming, inProgress, totalDowntimeHours: Number(totalDowntime._sum.downtimeHours || 0) };
}

module.exports = { createSchedule, listSchedules, dueSchedules, list, get, createWorkOrder, updateWorkOrder, completeService, listVendors, createVendor, updateVendor, costByVehicle, kpis };
