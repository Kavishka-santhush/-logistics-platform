const prisma = require('../lib/prisma');
const logger = require('../utils/logger.util');
const maintenanceService = require('../services/maintenance.service');
const notificationService = require('../services/notification.service');

async function activeOrgIds() {
  const orgs = await prisma.organization.findMany({ where: { isActive: true }, select: { id: true } });
  return orgs.map((o) => o.id);
}

/** Daily: alert OPS_MANAGER + ORG_ADMIN about due / overdue maintenance schedules. */
async function run() {
  const orgIds = await activeOrgIds();
  let total = 0;
  for (const orgId of orgIds) {
    try {
      const due = await maintenanceService.dueSchedules(orgId, { withinDays: 7, withinKm: 300 });
      if (!due.length) continue;
      total += due.length;
      const overdue = due.filter((s) => s.overdue);
      const body = overdue.length
        ? `${overdue.length} maintenance item(s) are OVERDUE and ${due.length - overdue.length} coming due this week.`
        : `${due.length} vehicle service(s) are due within the next 7 days.`;
      const payload = { due: due.map((s) => ({ vehicleId: s.vehicleId, type: s.type, nextDueKm: s.nextDueKm, nextDueAt: s.nextDueAt, overdue: s.overdue })) };
      await Promise.all([
        notificationService.broadcastToOrgRole(orgId, 'OPS_MANAGER', { type: 'MAINTENANCE_DUE', title: 'Maintenance due', body, payload }),
        notificationService.broadcastToOrgRole(orgId, 'ORG_ADMIN', { type: 'MAINTENANCE_DUE', title: 'Maintenance due', body, payload }),
      ]);
    } catch (e) {
      logger.warn(`maintenance job failed for org ${orgId}`, e.message);
    }
  }
  logger.info(`maintenance job: ${total} due items across ${orgIds.length} orgs`);
  return { orgs: orgIds.length, due: total };
}

module.exports = { run, name: 'maintenance' };
