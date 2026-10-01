const svc = require('../services/fuel.service');
const { h } = require('../utils/asyncHandler.util');
const { ok, created, paginated } = require('../utils/response.util');

const list = h(async (req, res) => { const r = await svc.list(req.organizationId, req.query); res.json(paginated(r.data, r)); });
const get = h(async (req, res) => res.json(ok(await svc.get(req.organizationId, req.params.id))));
const create = h(async (req, res) => res.status(201).json(created(await svc.create(req.organizationId, req.body))));
const remove = h(async (req, res) => { await svc.remove(req.organizationId, req.params.id); res.json(ok({ removed: true })); });
const bulkImport = h(async (req, res) => res.json(ok(await svc.bulkImport(req.organizationId, req.body.rows || req.body))));

const costReport = h(async (req, res) => res.json(ok(await svc.costReport(req.organizationId, req.query))));
const efficiencyComparison = h(async (req, res) => res.json(ok(await svc.efficiencyComparison(req.organizationId))));
const anomalies = h(async (req, res) => res.json(ok(await svc.anomalies(req.organizationId))));
const budgetVsActual = h(async (req, res) => res.json(ok(await svc.budgetVsActual(req.organizationId, req.query))));

const listCards = h(async (req, res) => { const r = await svc.listCards(req.organizationId, req.query); res.json(paginated(r.data, r)); });
const createCard = h(async (req, res) => res.status(201).json(created(await svc.createCard(req.organizationId, req.body))));
const updateCard = h(async (req, res) => res.json(ok(await svc.updateCard(req.organizationId, req.params.id, req.body))));

module.exports = { list, get, create, remove, bulkImport, costReport, efficiencyComparison, anomalies, budgetVsActual, listCards, createCard, updateCard };
