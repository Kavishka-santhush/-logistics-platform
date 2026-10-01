const svc = require('../services/compliance.service');
const { h } = require('../utils/asyncHandler.util');
const { ok, created, paginated } = require('../utils/response.util');

const listDocs = h(async (req, res) => { const r = await svc.listDocs(req.organizationId, req.query); res.json(paginated(r.data, r)); });
const addDocument = h(async (req, res) => res.status(201).json(created(await svc.addDocument(req.organizationId, req.body))));
const review = h(async (req, res) => res.json(ok(await svc.review(req.organizationId, req.params.id, { ...req.body, reviewerId: req.userId }))));
const removeDoc = h(async (req, res) => { await svc.removeDoc(req.organizationId, req.params.id); res.json(ok({ removed: true })); });
const dashboard = h(async (req, res) => res.json(ok(await svc.dashboard(req.organizationId))));
const auditReadiness = h(async (req, res) => res.json(ok(await svc.auditReadiness(req.organizationId))));

const submitInspection = h(async (req, res) => res.status(201).json(created(await svc.submitInspection(req.organizationId, req.body))));
const listInspections = h(async (req, res) => res.json(ok(await svc.listInspections(req.organizationId, req.query))));

const reportIncident = h(async (req, res) => res.status(201).json(created(await svc.reportIncident(req.organizationId, req.body, { userId: req.userId }))));
const resolveIncident = h(async (req, res) => res.json(ok(await svc.resolveIncident(req.organizationId, req.params.id, req.body))));
const listIncidents = h(async (req, res) => res.json(ok(await svc.listIncidents(req.organizationId, req.query))));

module.exports = { listDocs, addDocument, review, removeDoc, dashboard, auditReadiness, submitInspection, listInspections, reportIncident, resolveIncident, listIncidents };
