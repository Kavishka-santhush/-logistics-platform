const prisma = require('../lib/prisma');
const logger = require('../utils/logger.util');
const notificationService = require('../services/notification.service');

const STALE_MINUTES = 60; // no GPS ping for an on-trip vehicle

/**
 * Periodic watchdog: flag vehicles marked ON_TRIP that have gone quiet
 * (no tracking point within STALE_MINUTES) so ops can chase the tracker/driver.
 */
async function run() {
  const orgs = await prisma.organization.findMany({ where: { isActive: true }, select: { id: true, name: true } });
  const cutoff = new Date(Date.now() - STALE_MINUTES * 60000);
  let flagged = 0;

  for (const org of orgs) {
    const vehicles = await prisma.vehicle.findMany({
      where: { organizationId: org.id, status: 'ON_TRIP' },
      select: { id: true, plateNumber: true, assignedDriver: { select: { userId: true, name: true } } },
    });
    for (const v of vehicles) {
      const last = await prisma.trackingPoint.findFirst({ where: { vehicleId: v.id }, orderBy: { recordedAt: 'desc' }, select: { recordedAt: true } });
      const stale = !last || new Date(last.recordedAt) < cutoff;
      if (!stale) continue;
      flagged++;
      const body = `Vehicle ${v.plateNumber}${v.assignedDriver ? ` (driver ${v.assignedDriver.name})` : ''} is on an active trip but has not reported GPS since ${last ? new Date(last.recordedAt).toLocaleString() : 'ever'}.`;
      await notificationService.broadcastToOrgRole(org.id, 'OPS_MANAGER', { type: 'SYSTEM', title: 'Vehicle GPS offline', body, payload: { vehicleId: v.id, lastSeen: last?.recordedAt || null } });
      if (v.assignedDriver?.userId) {
        await notificationService.notifyUser({ userId: v.assignedDriver.userId, organizationId: org.id, type: 'SYSTEM', title: 'Confirm your location', body: 'Your app has stopped reporting location. Please open it and check GPS.', payload: { vehicleId: v.id }, forcePush: true }).catch(() => {});
      }
    }
  }
  logger.info(`tracking job: ${flagged} stale on-trip vehicle(s)`);
  return { flagged };
}

module.exports = { run, name: 'tracking' };
