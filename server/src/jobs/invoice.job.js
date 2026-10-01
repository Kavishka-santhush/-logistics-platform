const prisma = require('../lib/prisma');
const logger = require('../utils/logger.util');
const invoiceService = require('../services/invoice.service');
const reportService = require('../services/report.service');
const notificationService = require('../services/notification.service');

/** Daily: flip past-due invoices to OVERDUE and nudge finance + customers. */
async function markOverdue() {
  const now = new Date();
  const overdue = await prisma.invoice.findMany({
    where: { status: { in: ['SENT', 'PARTIALLY_PAID'] }, dueDate: { lt: now } },
    include: { customer: { select: { companyName: true, email: true } } },
  });
  for (const inv of overdue) {
    await prisma.invoice.update({ where: { id: inv.id }, data: { status: 'OVERDUE' } });
    await notificationService.broadcastToOrgRole(inv.organizationId, 'FINANCE_MANAGER', { type: 'INVOICE_SENT', title: `Invoice ${inv.number} overdue`, body: `${inv.customer.companyName} — ${inv.currency} ${Number(inv.balanceDue).toFixed(2)} past due since ${new Date(inv.dueDate).toLocaleDateString()}.`, payload: { invoiceId: inv.id } }).catch(() => {});
  }
  return overdue.length;
}

/** Runs daily: overdue sweep, recurring generation, scheduled report delivery. */
async function run() {
  const flaggedOverdue = await markOverdue().catch((e) => { logger.warn('invoice overdue sweep', e.message); return 0; });

  // Recurring invoices for orgs with any recurring template
  const orgsWithRecurring = await prisma.invoice.findMany({ where: { isRecurring: true }, distinct: ['organizationId'], select: { organizationId: true } });
  let recurring = 0;
  for (const { organizationId } of orgsWithRecurring) {
    const created = await invoiceService.runRecurring(organizationId).catch(() => []);
    recurring += created.length;
  }

  // Scheduled reports due across the platform
  const reportsRun = await reportService.runDueScheduled().catch((e) => { logger.warn('scheduled reports', e.message); return []; });

  logger.info(`invoice job: ${flaggedOverdue} overdue, ${recurring} recurring created, ${reportsRun.length} scheduled reports run`);
  return { flaggedOverdue, recurring, reportsRun: reportsRun.length };
}

module.exports = { run, name: 'invoice' };
