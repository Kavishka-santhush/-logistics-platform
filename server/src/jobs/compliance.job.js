const prisma = require('../lib/prisma');
const logger = require('../utils/logger.util');
const complianceService = require('../services/compliance.service');
const notificationService = require('../services/notification.service');

// Reminder thresholds (days before expiry). Each level is only sent once.
const LEVELS = [60, 30, 14, 7, 1];

/** Daily: send expiry reminders at each threshold, de-duplicated via doc.alertLevels. */
async function run() {
  let sent = 0;
  for (const level of LEVELS) {
    const docs = await complianceService.documentsExpiringWithin(level);
    for (const doc of docs) {
      if (doc.alertLevels && doc.alertLevels[String(level)]) continue; // already alerted
      const title = `Document expiring in ${level} day(s)`;
      const body = `${doc.type} “${doc.title}”${doc.vehicle ? ` for ${doc.vehicle.plateNumber}` : ''}${doc.driver ? ` (${doc.driver.name})` : ''} expires ${new Date(doc.expiryDate).toLocaleDateString()}.`;

      // Notify the org's compliance officer + admin
      await Promise.all([
        notificationService.broadcastToOrgRole(doc.organizationId, 'COMPLIANCE_OFFICER', { type: 'DOCUMENT_EXPIRY', title, body, payload: { documentId: doc.id, level } }),
        notificationService.broadcastToOrgRole(doc.organizationId, 'ORG_ADMIN', { type: 'DOCUMENT_EXPIRY', title, body, payload: { documentId: doc.id, level } }),
      ]);

      // Notify the affected driver directly
      if (doc.driver?.userId) {
        await notificationService.notifyUser({ userId: doc.driver.userId, organizationId: doc.organizationId, type: 'DOCUMENT_EXPIRY', title, body, payload: { documentId: doc.id, level } }).catch(() => {});
      }

      await complianceService.markAlertSent(doc.id, level);
      sent++;
    }
  }
  logger.info(`compliance job: ${sent} expiry alerts sent`);
  return { sent };
}

module.exports = { run, name: 'compliance' };
