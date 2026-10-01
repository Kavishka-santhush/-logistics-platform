const svc = require('../services/report.service');
const prisma = require('../lib/prisma');
const { h } = require('../utils/asyncHandler.util');
const { ok, created, paginated } = require('../utils/response.util');

/** Generate a report. With ?download=true streams the file; otherwise returns its persisted URL. */
const generate = h(async (req, res) => {
  const result = await svc.generate(req.organizationId, req.params.type, { format: req.query.format || req.body.format || 'pdf', params: { ...req.query, ...req.body }, persist: true });
  if (req.query.download === 'true') {
    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    return res.send(result.buffer);
  }
  res.json(ok({ url: result.url, filename: result.filename, rowCount: result.rowCount }));
});

const types = h(async (_req, res) => res.json(ok(svc.DATASET_TYPES)));

const listScheduled = h(async (req, res) => { const r = await svc.listScheduled(req.organizationId, req.query); res.json(paginated(r.data, r)); });
const createScheduled = h(async (req, res) => res.status(201).json(created(await svc.createScheduled(req.organizationId, req.body))));
const updateScheduled = h(async (req, res) => res.json(ok(await svc.updateScheduled(req.organizationId, req.params.id, req.body))));
const deleteScheduled = h(async (req, res) => { await svc.deleteScheduled(req.organizationId, req.params.id); res.json(ok({ removed: true })); });
const runScheduled = h(async (req, res) => {
  const report = await prisma.scheduledReport.findFirst({ where: { id: req.params.id, organizationId: req.organizationId } });
  if (!report) return res.status(404).json({ success: false, message: 'Scheduled report not found' });
  res.json(ok(await svc.runScheduled(report)));
});

module.exports = { generate, types, listScheduled, createScheduled, updateScheduled, deleteScheduled, runScheduled };
