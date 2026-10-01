const prisma = require('../lib/prisma');
const { crud } = require('../lib/crud');
const { notFound, badRequest } = require('../utils/response.util');

const base = crud('vehicle');

const list = (orgId, opts) => base.list(orgId, opts);
const get = (orgId, id) => base.byId(orgId, id, { include: { branch: true, assignedDriver: { select: { id: true, name: true } }, documents: true, maintenanceSchedules: true } }).then((r) => r || Promise.reject(notFound('Vehicle')));
const remove = (orgId, id) => base.remove(orgId, id);

/** Register a vehicle; computes initial book value from depreciation config. */
async function create(orgId, data) {
  const bookValue = computeBookValue(data);
  return prisma.vehicle.create({ data: { ...data, organizationId, currentBookValue: data.currentBookValue ?? bookValue } });
}

async function update(orgId, id, data) {
  await ensure(orgId, id);
  return prisma.vehicle.update({ where: { id }, data });
}

/** Toggle availability + status. */
async function setStatus(orgId, id, { status, isAvailable, availabilityNote }) {
  await ensure(orgId, id);
  return prisma.vehicle.update({ where: { id }, data: { status, isAvailable, availabilityNote } });
}

/** Assign (or unassign) a driver and/or branch. */
async function assign(orgId, id, { driverId, branchId }) {
  await ensure(orgId, id);
  if (driverId) {
    const driver = await prisma.driver.findFirst({ where: { id: driverId, organizationId: orgId } });
    if (!driver) throw notFound('Driver');
  }
  return prisma.vehicle.update({ where: { id }, data: { assignedDriverId: driverId ?? null, branchId: branchId ?? undefined } });
}

/** Manual odometer / telematics entry (when no hardware tracker). */
async function recordTelematics(orgId, id, { speedKmh, engineOn, odometerKm, fuelLevelPct, data }) {
  await ensure(orgId, id);
  await prisma.vehicleTelematics.create({
    data: { vehicleId: id, speedKmh: speedKmh || 0, engineOn: !!engineOn, odometerKm: odometerKm || 0, fuelLevelPct, data },
  });
  return prisma.vehicle.update({
    where: { id },
    data: { odometerKm: odometerKm || undefined, telematics: { speedKmh, engineOn, odometerKm, recordedAt: new Date().toISOString() } },
  });
}

// ── Depreciation & cost analytics ───────────────────────────────────────────
function computeBookValue(v) {
  const purchase = Number(v.purchasePrice || 0);
  const residual = purchase * (Number(v.residualValuePct ?? 10) / 100);
  const years = Number(v.usefulLifeYears || 10);
  const ageYears = v.purchaseDate ? (Date.now() - new Date(v.purchaseDate).getTime()) / (365.25 * 24 * 3600 * 1000) : 0;
  if (v.depreciationMethod === 'NONE') return purchase;
  if (v.depreciationMethod === 'REDUCING_BALANCE') {
    const rate = 1 - Math.pow(residual / purchase || 0, 1 / years);
    return Number((purchase * Math.pow(1 - rate, Math.min(ageYears, years))).toFixed(2));
  }
  // Straight line
  const annual = (purchase - residual) / years;
  return Number(Math.max(residual, purchase - annual * ageYears).toFixed(2));
}

/** Total cost of ownership: purchase + maintenance + fuel, and cost/km. */
async function costOfOwnership(orgId, id) {
  await ensure(orgId, id);
  const [vehicle, maint, fuel] = await Promise.all([
    prisma.vehicle.findUnique({ where: { id } }),
    prisma.maintenanceWorkOrder.aggregate({ where: { vehicleId: id }, _sum: { actualCost: true } }),
    prisma.fuelLog.aggregate({ where: { vehicleId: id }, _sum: { cost: true, liters: true } }),
  ]);
  const maintenanceCost = Number(maint._sum.actualCost || 0);
  const fuelCost = Number(fuel._sum.cost || 0);
  const odometer = Number(vehicle.odometerKm || 0);
  const totalCost = Number(vehicle.purchasePrice) + maintenanceCost + fuelCost;
  return {
    vehicleId: id,
    plateNumber: vehicle.plateNumber,
    purchasePrice: Number(vehicle.purchasePrice),
    maintenanceCost,
    fuelCost,
    totalCost,
    costPerKm: odometer > 0 ? Number((totalCost / odometer).toFixed(3)) : null,
    currentBookValue: vehicle.currentBookValue != null ? Number(vehicle.currentBookValue) : computeBookValue(vehicle),
  };
}

/** Utilization rate: % of assigned-window hours vs total, over last N days. */
async function utilization(orgId, { days = 30 } = {}) {
  const since = new Date(Date.now() - days * 24 * 3600 * 1000);
  const vehicles = await prisma.vehicle.findMany({
    where: { organizationId: orgId },
    select: {
      id: true,
      plateNumber: true,
      status: true,
      _count: { select: { dispatches: true } },
      dispatches: { where: { dispatchedAt: { gte: since } }, select: { acceptedAt: true, status: true } },
    },
  });
  const windowHours = days * 24;
  return vehicles.map((v) => {
    const active = v.dispatches.filter((d) => d.status === 'ACCEPTED').length;
    const estBusyHours = Math.min(windowHours, active * 6); // heuristic 6h/shift
    return {
      vehicleId: v.id,
      plateNumber: v.plateNumber,
      status: v.status,
      assignments: active,
      utilizationPct: Number(((estBusyHours / windowHours) * 100).toFixed(1)),
    };
  });
}

async function ensure(orgId, id) {
  const v = await prisma.vehicle.findFirst({ where: { id, organizationId: orgId }, select: { id: true } });
  if (!v) throw notFound('Vehicle');
}

module.exports = { list, get, create, update, remove, setStatus, assign, recordTelematics, costOfOwnership, utilization, computeBookValue };
