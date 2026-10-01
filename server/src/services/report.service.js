const fs = require('fs/promises');
const path = require('path');
const prisma = require('../lib/prisma');
const config = require('../config');
const pdfLib = require('../lib/pdf');
const { sendEmail } = require('../lib/mailer');
const { crud } = require('../lib/crud');
const { notFound, badRequest } = require('../utils/response.util');
const analytics = require('./analytics.service');

const schedCrud = crud('scheduledReport');

// ── Dataset builders ────────────────────────────────────────────────────────────
// Each returns { columns: [{ key, label }], rows: [ {...} ] } so any format can render it.

async function ordersDataset(orgId, { from, to } = {}) {
  const where = { organizationId: orgId, ...(from || to ? { createdAt: { ...(from && { gte: new Date(from) }), ...(to && { lte: new Date(to) }) } } : {}) };
  const orders = await prisma.order.findMany({ where, include: { customer: { select: { companyName: true } }, assignedDriver: { select: { name: true } }, assignedVehicle: { select: { plateNumber: true } } }, orderBy: { createdAt: 'desc' }, take: 10000 });
  return {
    columns: [
      { key: 'orderNumber', label: 'Order #' }, { key: 'trackingNumber', label: 'Tracking' },
      { key: 'customer', label: 'Customer' }, { key: 'status', label: 'Status' }, { key: 'type', label: 'Type' },
      { key: 'deliveryCity', label: 'City' }, { key: 'driver', label: 'Driver' }, { key: 'vehicle', label: 'Vehicle' },
      { key: 'chargeAmount', label: 'Charge' }, { key: 'currency', label: 'Cur' }, { key: 'createdAt', label: 'Created' },
    ],
    rows: orders.map((o) => ({ orderNumber: o.orderNumber, trackingNumber: o.trackingNumber, customer: o.customer?.companyName, status: o.status, type: o.type, deliveryCity: o.deliveryCity, driver: o.assignedDriver?.name || '', vehicle: o.assignedVehicle?.plateNumber || '', chargeAmount: o.chargeAmount, currency: o.currency, createdAt: new Date(o.createdAt).toISOString() })),
  };
}

async function fleetDataset(orgId) {
  const vehicles = await prisma.vehicle.findMany({ where: { organizationId: orgId }, include: { _count: { select: { fuelLogs: true, maintenanceWorkOrders: true } } }, orderBy: { plateNumber: 'asc' } });
  return {
    columns: [{ key: 'plateNumber', label: 'Plate' }, { key: 'type', label: 'Type' }, { key: 'status', label: 'Status' }, { key: 'odometerKm', label: 'Odometer' }, { key: 'fuelLogs', label: 'Fill-ups' }, { key: 'workOrders', label: 'Service Jobs' }],
    rows: vehicles.map((v) => ({ plateNumber: v.plateNumber, type: v.type, status: v.status, odometerKm: v.odometerKm, fuelLogs: v._count.fuelLogs, workOrders: v._count.maintenanceWorkOrders })),
  };
}

async function revenueDataset(orgId, { from, to } = {}) {
  const days = from && to ? Math.ceil((new Date(to) - new Date(from)) / 864e5) : 30;
  const series = await analytics.timeseries(orgId, { days });
  return { columns: [{ key: 'date', label: 'Date' }, { key: 'orders', label: 'Orders' }, { key: 'delivered', label: 'Delivered' }, { key: 'revenue', label: 'Revenue' }], rows: series };
}

async function invoicesDataset(orgId, { status } = {}) {
  const invoices = await prisma.invoice.findMany({ where: { organizationId: orgId, ...(status ? { status } : {}) }, include: { customer: { select: { companyName: true } } }, orderBy: { issueDate: 'desc' } });
  return {
    columns: [{ key: 'number', label: 'Invoice #' }, { key: 'customer', label: 'Customer' }, { key: 'status', label: 'Status' }, { key: 'issueDate', label: 'Issued' }, { key: 'dueDate', label: 'Due' }, { key: 'totalAmount', label: 'Total' }, { key: 'balanceDue', label: 'Balance' }, { key: 'currency', label: 'Cur' }],
    rows: invoices.map((i) => ({ number: i.number, customer: i.customer.companyName, status: i.status, issueDate: new Date(i.issueDate).toISOString().slice(0, 10), dueDate: new Date(i.dueDate).toISOString().slice(0, 10), totalAmount: i.totalAmount, balanceDue: i.balanceDue, currency: i.currency })),
  };
}

async function complianceDataset(orgId) {
  const docs = await prisma.complianceDocument.findMany({ where: { organizationId: orgId }, include: { vehicle: { select: { plateNumber: true } }, driver: { select: { name: true } } }, orderBy: { expiryDate: 'asc' } });
  return {
    columns: [{ key: 'type', label: 'Type' }, { key: 'title', label: 'Title' }, { key: 'vehicle', label: 'Vehicle' }, { key: 'driver', label: 'Driver' }, { key: 'expiryDate', label: 'Expiry' }, { key: 'status', label: 'Status' }],
    rows: docs.map((d) => ({ type: d.type, title: d.title, vehicle: d.vehicle?.plateNumber || '', driver: d.driver?.name || '', expiryDate: d.expiryDate ? new Date(d.expiryDate).toISOString().slice(0, 10) : '', status: d.status })),
  };
}

const DATASETS = {
  orders: ordersDataset,
  fleet: (orgId) => fleetDataset(orgId),
  revenue: revenueDataset,
  invoices: (orgId, p) => invoicesDataset(orgId, p),
  compliance: (orgId) => complianceDataset(orgId),
  drivers: async (orgId) => { const rows = await analytics.driverLeaderboard(orgId, { limit: 1000, days: 365 }); return { columns: [{ key: 'name', label: 'Driver' }, { key: 'deliveries', label: 'Deliveries' }, { key: 'revenue', label: 'Revenue' }, { key: 'onTimeRate', label: 'On-time %' }], rows }; },
  fuel: async (orgId) => { const c = await require('./fuel.service').costReport(orgId, {}); return { columns: [{ key: 'plateNumber', label: 'Vehicle' }, { key: 'liters', label: 'Liters' }, { key: 'cost', label: 'Cost' }], rows: c.byVehicle }; },
};

async function buildDataset(orgId, type, params = {}) {
  const fn = DATASETS[type];
  if (!fn) throw badRequest(`Unknown report type: ${type}`);
  return fn(orgId, params);
}

// ── Renderers ────────────────────────────────────────────────────────────────────
function toCsv({ columns, rows }) {
  const esc = (v) => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const header = columns.map((c) => esc(c.label)).join(',');
  const lines = rows.map((r) => columns.map((c) => esc(r[c.key])).join(','));
  return [header, ...lines].join('\r\n');
}

async function toXlsxBuffer({ columns, rows }, sheetName = 'Report') {
  const ExcelJS = require('exceljs');
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(sheetName);
  ws.columns = columns.map((c) => ({ header: c.label, key: c.key, width: Math.max(12, c.label.length + 4) }));
  ws.getRow(1).font = { bold: true };
  rows.forEach((r) => ws.addRow(r));
  return Buffer.from(await wb.xlsx.writeBuffer());
}

function datasetToHtml(title, { columns, rows }, meta) {
  const th = columns.map((c) => `<th>${c.label}</th>`).join('');
  const tr = rows.map((r) => `<tr>${columns.map((c) => `<td>${r[c.key] == null ? '' : String(r[c.key])}</td>`).join('')}</tr>`).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    *{font-family:Arial,Helvetica,sans-serif}body{margin:24px;color:#0f172a}
    h1{font-size:20px;margin:0 0 4px}.meta{color:#64748b;font-size:12px;margin-bottom:16px}
    table{width:100%;border-collapse:collapse;font-size:11px}
    th{background:#f1f5f9;text-align:left;padding:6px;border-bottom:2px solid #cbd5e1}
    td{padding:6px;border-bottom:1px solid #e2e8f0}
    tr:nth-child(even) td{background:#f8fafc}
  </style></head><body>
    <h1>${title}</h1><div class="meta">${meta || ''} · ${rows.length} rows · generated ${new Date().toISOString()}</div>
    <table><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table>
  </body></html>`;
}

/**
 * Generate a report in the requested format.
 * @returns { url, buffer, filename, contentType } — buffer for in-memory download,
 *          url persisted under /uploads/reports for emailed/scheduled delivery.
 */
async function generate(orgId, type, { format = 'pdf', params = {}, persist = true } = {}) {
  const dataset = await buildDataset(orgId, type, params);
  const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { name: true } });
  const title = `${org?.name || 'Report'} — ${type}`;
  const stamp = new Date().toISOString().slice(0, 10);
  let buffer, filename, contentType;

  if (format === 'csv') {
    buffer = Buffer.from(toCsv(dataset), 'utf-8');
    filename = `${type}-${stamp}.csv`;
    contentType = 'text/csv';
  } else if (format === 'xlsx') {
    buffer = await toXlsxBuffer(dataset, type);
    filename = `${type}-${stamp}.xlsx`;
    contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  } else {
    buffer = await pdfLib.htmlToPdf(datasetToHtml(title, dataset, org?.name), { landscape: dataset.columns.length > 6 });
    filename = `${type}-${stamp}.pdf`;
    contentType = 'application/pdf';
  }

  let url = null;
  if (persist) {
    const dir = path.join(config.uploadAbsDir, 'reports');
    await fs.mkdir(dir, { recursive: true });
    const safe = filename.replace(/[^A-Za-z0-9._-]/g, '_');
    await fs.writeFile(path.join(dir, safe), buffer);
    url = `/${config.uploadDir}/reports/${safe}`;
  }
  return { url, buffer, filename, contentType, rowCount: dataset.rows.length };
}

// ── Scheduled reports ─────────────────────────────────────────────────────────────
const listScheduled = (orgId, opts) => schedCrud.list(orgId, opts);
const createScheduled = (orgId, data) => {
  if (!DATASETS[data.type]) throw badRequest(`Unknown report type: ${data.type}`);
  return schedCrud.create(orgId, { name: data.name, type: data.type, frequency: data.frequency, recipients: data.recipients || [], format: data.format || 'pdf', cronExpression: data.cronExpression, nextRunAt: data.nextRunAt ? new Date(data.nextRunAt) : null });
};
const updateScheduled = (orgId, id, data) => schedCrud.update(orgId, id, data);
const deleteScheduled = (orgId, id) => schedCrud.remove(orgId, id);

/** Generate + email a single scheduled report; updates lastRunAt/nextRunAt. */
async function runScheduled(report) {
  const { url } = await generate(report.organizationId, report.type, { format: report.format, persist: true });
  const links = [];
  for (const to of report.recipients || []) {
    try {
      await sendEmail({ to, subject: `Scheduled report: ${report.name}`, html: `<p>Your scheduled <strong>${report.name}</strong> (${report.type}) report is ready.</p>${url ? `<p><a href="${config.publicBaseUrl}${url}">Download ${report.format.toUpperCase()}</a></p>` : ''}` });
      links.push({ to, ok: true });
    } catch (e) { links.push({ to, ok: false, error: e.message }); }
  }
  await prisma.scheduledReport.update({ where: { id: report.id }, data: { lastRunAt: new Date(), nextRunAt: nextRunDate(report.frequency) } });
  return { reportId: report.id, delivered: links };
}

/** Compute the next run for a cadence label (used when no cronExpression stored). */
function nextRunDate(frequency) {
  const d = new Date();
  if (frequency === 'daily') d.setDate(d.getDate() + 1);
  else if (frequency === 'weekly') d.setDate(d.getDate() + 7);
  else d.setMonth(d.getMonth() + 1);
  d.setHours(6, 0, 0, 0);
  return d;
}

/** Cron entrypoint: run all scheduled reports whose nextRunAt has passed. */
async function runDueScheduled() {
  const due = await prisma.scheduledReport.findMany({ where: { isActive: true, nextRunAt: { lte: new Date() } } });
  const results = [];
  for (const r of due) { try { results.push(await runScheduled(r)); } catch (e) { results.push({ reportId: r.id, error: e.message }); } }
  return results;
}

module.exports = { buildDataset, toCsv, toXlsxBuffer, generate, listScheduled, createScheduled, updateScheduled, deleteScheduled, runScheduled, runDueScheduled, DATASET_TYPES: Object.keys(DATASETS) };
