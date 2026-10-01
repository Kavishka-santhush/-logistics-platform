const prisma = require('../lib/prisma');
const { crud } = require('../lib/crud');
const { notFound } = require('../utils/response.util');
const { haversineKm } = require('../utils/haversine.util');

const base = crud('fuelLog');
const cardCrud = crud('fuelCard');
const list = (orgId, opts) => base.list(orgId, opts);
const remove = (orgId, id) => base.remove(orgId, id);

/**
 * Log a fill-up. Computes L/100km from the previous fill's odometer reading and
 * flags anomalies when consumption deviates strongly from the vehicle baseline.
 */
async function create(orgId, data) {
  const vehicle = await prisma.vehicle.findFirst({ where: { id: data.vehicleId, organizationId: orgId } });
  if (!vehicle) throw notFound('Vehicle');

  const prev = await prisma.fuelLog.findFirst({ where: { vehicleId: data.vehicleId }, orderBy: { date: 'desc' } });
  let consumption = null;
  if (prev && Number(data.odometerKm) > Number(prev.odometerKm)) {
    const dist = Number(data.odometerKm) - Number(prev.odometerKm);
    consumption = Number(((Number(data.liters) / dist) * 100).toFixed(2));
  }

  const baseline = await avgConsumption(data.vehicleId);
  const isAnomaly = consumption != null && baseline != null && consumption > baseline * 1.35;

  const log = await prisma.fuelLog.create({
    data: {
      organizationId: orgId,
      vehicleId: data.vehicleId,
      driverId: data.driverId || null,
      fuelCardId: data.fuelCardId || null,
      date: new Date(data.date),
      liters: Number(data.liters),
      cost: Number(data.cost),
      pricePerLiter: data.pricePerLiter || Number(data.cost) / Number(data.liters),
      odometerKm: Number(data.odometerKm),
      stationName: data.stationName,
      stationBrand: data.stationBrand,
      receiptUrl: data.receiptUrl,
      consumptionPer100Km: consumption,
      isAnomaly,
      anomalyNote: isAnomaly ? `Consumption ${consumption} L/100km exceeds baseline ${baseline}` : null,
      source: data.source || 'manual',
    },
  });
  if (data.fuelCardId) await prisma.fuelCard.update({ where: { id: data.fuelCardId }, data: { monthlySpend: { increment: Number(data.cost) } } });
  return log;
}

async function avgConsumption(vehicleId) {
  const r = await prisma.fuelLog.aggregate({ where: { vehicleId, consumptionPer100Km: { not: null } }, _avg: { consumptionPer100Km: true } });
  return r._avg.consumptionPer100Km != null ? Number(r._avg.consumptionPer100Km.toFixed(2)) : null;
}

async function get(orgId, id) {
  const f = await prisma.fuelLog.findFirst({ where: { id, organizationId: orgId }, include: { vehicle: { select: { plateNumber: true } }, driver: { select: { name: true } } } });
  if (!f) throw notFound('Fuel log');
  return f;
}

// ── Reports ──────────────────────────────────────────────────────────────────
async function costReport(orgId, { from, to } = {}) {
  const where = { organizationId: orgId, ...(from || to ? { date: { ...(from && { gte: new Date(from) }), ...(to && { lte: new Date(to) }) } } : {}) };
  const [byVehicle, byDriver, totals] = await Promise.all([
    prisma.fuelLog.groupBy({ by: ['vehicleId'], where, _sum: { cost: true, liters: true } }),
    prisma.fuelLog.groupBy({ by: ['driverId'], where, _sum: { cost: true }, _count: { _all: true } }),
    prisma.fuelLog.aggregate({ where, _sum: { cost: true, liters: true } }),
  ]);
  const vehicles = await prisma.vehicle.findMany({ where: { id: { in: byVehicle.map((v) => v.vehicleId) } }, select: { id: true, plateNumber: true } });
  const vm = Object.fromEntries(vehicles.map((v) => [v.id, v.plateNumber]));
  return {
    totalCost: Number(totals._sum.cost || 0),
    totalLiters: Number(totals._sum.liters || 0),
    byVehicle: byVehicle.map((v) => ({ vehicleId: v.vehicleId, plateNumber: vm[v.vehicleId], cost: Number(v._sum.cost || 0), liters: Number(v._sum.liters || 0) })),
    byDriver: byDriver.filter((d) => d.driverId).map((d) => ({ driverId: d.driverId, cost: Number(d._sum.cost || 0), fillups: d._count._all })),
  };
}

/** Best & worst fuel efficiency vehicles. */
async function efficiencyComparison(orgId) {
  const vehicles = await prisma.vehicle.findMany({ where: { organizationId: orgId }, select: { id: true, plateNumber: true, type: true } });
  const rows = [];
  for (const v of vehicles) {
    const c = await avgConsumption(v.id);
    if (c != null) rows.push({ vehicleId: v.id, plateNumber: v.plateNumber, type: v.type, consumptionPer100Km: c });
  }
  rows.sort((a, b) => a.consumptionPer100Km - b.consumptionPer100Km);
  return { best: rows.slice(0, 5), worst: rows.slice(-5).reverse(), all: rows };
}

async function anomalies(orgId) {
  return prisma.fuelLog.findMany({ where: { organizationId: orgId, isAnomaly: true }, orderBy: { date: 'desc' }, take: 100, include: { vehicle: { select: { plateNumber: true } } } });
}

/** Budget vs actual for the current month. */
async function budgetVsActual(orgId, { monthlyBudget }) {
  const start = new Date(); start.setDate(1); start.setHours(0, 0, 0, 0);
  const r = await prisma.fuelLog.aggregate({ where: { organizationId: orgId, date: { gte: start } }, _sum: { cost: true } });
  const actual = Number(r._sum.cost || 0);
  return { monthlyBudget, actual, variance: monthlyBudget - actual, pctUsed: monthlyBudget ? Number(((actual / monthlyBudget) * 100).toFixed(1)) : 0 };
}

/** Bulk CSV import of fuel logs. */
async function bulkImport(orgId, rows) {
  const results = [];
  for (const row of rows) {
    try { results.push({ ok: true, id: (await create(orgId, row)).id }); }
    catch (e) { results.push({ ok: false, error: e.message, row }); }
  }
  return results;
}

// ── Fuel cards ────────────────────────────────────────────────────────────────
const listCards = (orgId, opts) => cardCrud.list(orgId, opts);
const createCard = (orgId, data) => cardCrud.create(orgId, data);
const updateCard = (orgId, id, data) => cardCrud.update(orgId, id, data);

module.exports = { list, get, create, remove, costReport, efficiencyComparison, anomalies, budgetVsActual, bulkImport, listCards, createCard, updateCard };
