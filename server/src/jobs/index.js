const cron = require('node-cron');
const logger = require('../utils/logger.util');
const prisma = require('../lib/prisma');
const analyticsService = require('../services/analytics.service');

const maintenanceJob = require('./maintenance.job');
const complianceJob = require('./compliance.job');
const trackingJob = require('./tracking.job');
const invoiceJob = require('./invoice.job');

// name → cron expression (server-local time)
const SCHEDULE = {
  maintenance: '0 7 * * *',   // 07:00 daily
  compliance: '0 8 * * *',    // 08:00 daily
  invoice: '0 2 * * *',       // 02:00 daily
  tracking: '*/30 * * * *',   // every 30 min
  analyticsSnapshot: '30 23 * * *', // 23:30 daily
};

/** Daily: persist an analytics snapshot per org for historical trending. */
async function analyticsSnapshotJob() {
  const orgs = await prisma.organization.findMany({ where: { isActive: true }, select: { id: true } });
  for (const { id } of orgs) {
    await analyticsService.captureSnapshot(id, { scope: 'daily' }).catch((e) => logger.warn(`snapshot ${id}`, e.message));
  }
  return { orgs: orgs.length };
}

const JOBS = {
  maintenance: maintenanceJob,
  compliance: complianceJob,
  invoice: invoiceJob,
  tracking: trackingJob,
  analyticsSnapshot: { run: analyticsSnapshotJob, name: 'analyticsSnapshot' },
};

let started = false;

/** Register all scheduled jobs. Safe to call once at server boot. */
function startJobs() {
  if (started) return;
  started = true;
  const tasks = [];

  for (const [key, job] of Object.entries(JOBS)) {
    const expr = SCHEDULE[key];
    if (!cron.validate(expr)) {
      logger.warn(`invalid cron for ${key}: ${expr}`);
      continue;
    }
    const task = cron.schedule(expr, () => {
      logger.info(`▶ scheduled job: ${job.name}`);
      Promise.resolve(job.run())
        .then((r) => logger.info(`✔ ${job.name}`, JSON.stringify(r)))
        .catch((e) => logger.error(`✖ ${job.name} failed`, e));
    });
    tasks.push(task);
  }

  logger.info(`Scheduled jobs started: ${Object.keys(JOBS).join(', ')}`);
  return tasks;
}

module.exports = { startJobs, JOBS, SCHEDULE };
