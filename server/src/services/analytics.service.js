const prisma = require('../lib/prisma');

const DAY = 864e5;

function range({ from, to, days = 30 }) {
  const end = to ? new Date(to) : new Date();
  const start = from ? new Date(from) : new Date(end.getTime() - days * DAY);
  return { start, end };
}

/** On-time delivery % over a window (delivered before promisedAt / isLate=false). */
async function onTimeRate(orgId, { start, end }) {
  const delivered = await prisma.order.count({ where: { organizationId: orgId, status: 'DELIVERED', deliveredAt: { gte: start, lte: end } } });
  if (!delivered) return { rate: null, delivered: 0 };
  const onTime = await prisma.order.count({ where: { organizationId: orgId, status: 'DELIVERED', isLate: false, deliveredAt: { gte: start, lte: end } } });
  return { delivered, onTime, rate: Number(((onTime / delivered) * 100).toFixed(1)) };
}

/** Fleet utilisation: vehicles with an active assignment / total active vehicles. */
async function fleetUtilization(orgId) {
  const [total, active] = await Promise.all([
    prisma.vehicle.count({ where: { organizationId: orgId, status: { not: 'RETIRED' } } }),
    prisma.vehicle.count({ where: { organizationId: orgId, status: { in: ['ON_TRIP', 'ASSIGNED', 'IN_MAINTENANCE'] } } }),
  ]);
  return { total, active, utilizationPct: total ? Number(((active / total) * 100).toFixed(1)) : 0 };
}

/** Revenue = sum of order charges by currency over a window. */
async function revenue(orgId, { start, end }) {
  const rows = await prisma.order.groupBy({ by: ['currency'], where: { organizationId: orgId, status: { notIn: ['CANCELLED', 'DRAFT'] }, createdAt: { gte: start, lte: end } }, _sum: { chargeAmount: true } });
  const total = rows.reduce((s, r) => s + Number(r._sum.chargeAmount || 0), 0);
  return { total: Number(total.toFixed(2)), byCurrency: rows.map((r) => ({ currency: r.currency, amount: Number(r._sum.chargeAmount || 0) })) };
}

/** Daily order-volume + revenue series for charting. */
async function timeseries(orgId, { days = 30 } = {}) {
  const { start, end } = range({ days });
  const orders = await prisma.order.findMany({ where: { organizationId: orgId, createdAt: { gte: start, lte: end } }, select: { createdAt: true, chargeAmount: true, status: true, currency: true } });
  const map = {};
  for (let d = new Date(start); d <= end; d = new Date(d.getTime() + DAY)) {
    map[d.toISOString().slice(0, 10)] = { date: d.toISOString().slice(0, 10), orders: 0, delivered: 0, revenue: 0 };
  }
  for (const o of orders) {
    const k = new Date(o.createdAt).toISOString().slice(0, 10);
    if (!map[k]) continue;
    map[k].orders++;
    if (o.status === 'DELIVERED') map[k].delivered++;
    map[k].revenue += Number(o.chargeAmount || 0);
  }
  return Object.values(map).map((r) => ({ ...r, revenue: Number(r.revenue.toFixed(2)) }));
}

/** Status distribution across the org's orders. */
async function orderStatusBreakdown(orgId) {
  const g = await prisma.order.groupBy({ by: ['status'], where: { organizationId: orgId }, _count: { _all: true } });
  return g.map((x) => ({ status: x.status, count: x._count._all })).sort((a, b) => b.count - a.count);
}

/** Top customers / drivers by volume or performance. */
async function topCustomers(orgId, { limit = 10, days = 90 } = {}) {
  const { start, end } = range({ days });
  const g = await prisma.order.groupBy({ by: ['customerId'], where: { organizationId: orgId, createdAt: { gte: start, lte: end } }, _count: { _all: true }, _sum: { chargeAmount: true } });
  const custs = await prisma.customer.findMany({ where: { id: { in: g.map((x) => x.customerId) } }, select: { id: true, companyName: true } });
  const m = Object.fromEntries(custs.map((c) => [c.id, c.companyName]));
  return g.map((x) => ({ customerId: x.customerId, companyName: m[x.customerId], orders: x._count._all, revenue: Number(x._sum.chargeAmount || 0) })).sort((a, b) => b.revenue - a.revenue).slice(0, limit);
}

async function driverLeaderboard(orgId, { limit = 10, days = 90 } = {}) {
  const { start, end } = range({ days });
  const g = await prisma.order.groupBy({ by: ['assignedDriverId'], where: { organizationId: orgId, status: 'DELIVERED', deliveredAt: { gte: start, lte: end }, assignedDriverId: { not: null } }, _count: { _all: true }, _sum: { chargeAmount: true } });
  const drivers = await prisma.driver.findMany({ where: { id: { in: g.map((x) => x.assignedDriverId) } }, select: { id: true, name: true } });
  const m = Object.fromEntries(drivers.map((d) => [d.id, d.name]));
  const rows = [];
  for (const x of g) {
    const total = await prisma.order.count({ where: { assignedDriverId: x.assignedDriverId, status: { in: ['DELIVERED', 'FAILED'] } } });
    const onTime = await prisma.order.count({ where: { assignedDriverId: x.assignedDriverId, status: 'DELIVERED', isLate: false } });
    rows.push({ driverId: x.assignedDriverId, name: m[x.assignedDriverId], deliveries: x._count._all, revenue: Number(x._sum.chargeAmount || 0), onTimeRate: total ? Number(((onTime / total) * 100).toFixed(1)) : null });
  }
  return rows.sort((a, b) => b.deliveries - a.deliveries).slice(0, limit);
}

/** Operational cost roll-up: fuel + maintenance over a window. */
async function costSummary(orgId, { days = 30 } = {}) {
  const { start, end } = range({ days });
  const [fuel, maint] = await Promise.all([
    prisma.fuelLog.aggregate({ where: { organizationId: orgId, date: { gte: start, lte: end } }, _sum: { cost: true } }),
    prisma.maintenanceWorkOrder.aggregate({ where: { organizationId: orgId, status: 'COMPLETED', completedAt: { gte: start, lte: end } }, _sum: { actualCost: true } }),
  ]);
  return { fuelCost: Number(fuel._sum.cost || 0), maintenanceCost: Number(maint._sum.actualCost || 0), total: Number(((fuel._sum.cost || 0) + (maint._sum.actualCost || 0)).toFixed(2)) };
}

/** Headline KPI tiles for the main dashboard. */
async function overview(orgId, { days = 30 } = {}) {
  const { start, end } = range({ days });
  const [ordersTotal, delivered, failed, otd, util, rev, cost, activeDrivers, openInvoices] = await Promise.all([
    prisma.order.count({ where: { organizationId: orgId, createdAt: { gte: start, lte: end } } }),
    prisma.order.count({ where: { organizationId: orgId, status: 'DELIVERED', deliveredAt: { gte: start, lte: end } } }),
    prisma.order.count({ where: { organizationId: orgId, status: 'FAILED', createdAt: { gte: start, lte: end } } }),
    onTimeRate(orgId, { start, end }),
    fleetUtilization(orgId),
    revenue(orgId, { start, end }),
    costSummary(orgId, { days }),
    prisma.driver.count({ where: { organizationId: orgId, status: 'ACTIVE' } }),
    prisma.invoice.count({ where: { organizationId: orgId, status: { in: ['SENT', 'PARTIALLY_PAID', 'OVERDUE'] } } }),
  ]);
  return {
    windowDays: days,
    ordersTotal,
    delivered,
    failed,
    failureRate: ordersTotal ? Number(((failed / ordersTotal) * 100).toFixed(1)) : 0,
    onTime: otd,
    fleet: util,
    revenue: rev.total,
    operationalCost: cost.total,
    grossMargin: rev.total ? Number((((rev.total - cost.total) / rev.total) * 100).toFixed(1)) : null,
    activeDrivers,
    openInvoices,
  };
}

// ── Snapshots ─────────────────────────────────────────────────────────────────
/** Persist a computed metrics snapshot (called by cron for historical trends). */
async function captureSnapshot(orgId, { scope = 'daily' } = {}) {
  const days = scope === 'daily' ? 1 : scope === 'weekly' ? 7 : 30;
  const { start, end } = range({ days });
  const [ov, util, otd] = await Promise.all([overview(orgId, { days }), fleetUtilization(orgId), onTimeRate(orgId, { start, end })]);
  return prisma.analyticsSnapshot.create({
    data: { organizationId: orgId, scope, periodStart: start, periodEnd: end, metrics: { ...ov, fleet: util, onTime: otd } },
  });
}

const listSnapshots = (orgId, { scope, limit = 90 } = {}) =>
  prisma.analyticsSnapshot.findMany({ where: { organizationId: orgId, ...(scope ? { scope } : {}) }, orderBy: { periodStart: 'desc' }, take: limit });

module.exports = { onTimeRate, fleetUtilization, revenue, timeseries, orderStatusBreakdown, topCustomers, driverLeaderboard, costSummary, overview, captureSnapshot, listSnapshots };
