const prisma = require('../lib/prisma');
const { crud } = require('../lib/crud');
const { notFound, badRequest } = require('../utils/response.util');
const notificationService = require('./notification.service');

/** Fleet-wide overview for the org admin dashboard. */
async function overview(orgId) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const [byStatus, byType, totalVehicles, activeToday, driversActive, utilization] = await Promise.all([
    prisma.vehicle.groupBy({ by: ['status'], where: { organizationId: orgId }, _count: { _all: true } }),
    prisma.vehicle.groupBy({ by: ['type'], where: { organizationId: orgId }, _count: { _all: true } }),
    prisma.vehicle.count({ where: { organizationId: orgId } }),
    prisma.trackingPoint.findMany({
      where: { organizationId: orgId, recordedAt: { gte: today } },
      distinct: ['vehicleId'],
      select: { vehicleId: true },
    }),
    prisma.driver.count({ where: { organizationId: orgId, status: 'ON_DELIVERY' } }),
    require('./vehicle.service').utilization(orgId),
  ]);

  const statusMap = Object.fromEntries(byStatus.map((s) => [s.status, s._count._all]));
  const available = statusMap.AVAILABLE || 0;
  return {
    totalVehicles,
    byStatus: statusMap,
    byType: Object.fromEntries(byType.map((t) => [t.type, t._count._all])),
    activeToday: activeToday.length,
    available,
    availabilityPct: totalVehicles ? Number(((available / totalVehicles) * 100).toFixed(1)) : 0,
    driversOnDelivery: driversActive,
    avgUtilizationPct: utilization.length
      ? Number((utilization.reduce((a, v) => a + v.utilizationPct, 0) / utilization.length).toFixed(1))
      : 0,
  };
}

/** Fleet cost roll-up: maintenance + fuel spend by period. */
async function costSummary(orgId, { from, to } = {}) {
  const range = { gte: from ? new Date(from) : new Date(Date.now() - 30 * 864e5), ...(to && { lte: new Date(to) }) };
  const [fuel, maint] = await Promise.all([
    prisma.fuelLog.aggregate({ where: { organizationId: orgId, date: range }, _sum: { cost: true, liters: true } }),
    prisma.maintenanceWorkOrder.aggregate({ where: { organizationId: orgId, createdAt: range }, _sum: { actualCost: true } }),
  ]);
  return {
    fuelCost: Number(fuel._sum.cost || 0),
    fuelLiters: Number(fuel._sum.liters || 0),
    maintenanceCost: Number(maint._sum.actualCost || 0),
    totalFleetOpCost: Number(fuel._sum.cost || 0) + Number(maint._sum.actualCost || 0),
  };
}

module.exports = { overview, costSummary };
