const svc = require('../services/route.service');
const { h } = require('../utils/asyncHandler.util');
const { ok, created, paginated } = require('../utils/response.util');

const list = h(async (req, res) => { const r = await svc.list(req.organizationId, req.query); res.json(paginated(r.data, r)); });
const get = h(async (req, res) => res.json(ok(await svc.get(req.organizationId, req.params.id))));
const create = h(async (req, res) => res.status(201).json(created(await svc.create(req.organizationId, req.body, { plannedBy: req.userId }))));
const update = h(async (req, res) => res.json(ok(await svc.update(req.organizationId, req.params.id, req.body))));
const remove = h(async (req, res) => { await svc.remove(req.organizationId, req.params.id); res.json(ok({ removed: true })); });
const assign = h(async (req, res) => res.json(ok(await svc.assign(req.organizationId, req.params.id, { ...req.body, dispatchedBy: req.userId }))));
const start = h(async (req, res) => res.json(ok(await svc.start(req.organizationId, req.params.id))));
const complete = h(async (req, res) => res.json(ok(await svc.complete(req.organizationId, req.params.id))));
const updateStop = h(async (req, res) => res.json(ok(await svc.updateStop(req.organizationId, req.params.stopId, req.body))));
const reroute = h(async (req, res) => res.json(ok(await svc.reroute(req.organizationId, req.params.id))));

const listTemplates = h(async (req, res) => res.json(ok(await svc.listTemplates(req.organizationId, req.query))));
const saveTemplate = h(async (req, res) => res.status(201).json(created(await svc.saveTemplate(req.organizationId, req.body))));
const removeTemplate = h(async (req, res) => { await svc.removeTemplate(req.organizationId, req.params.id); res.json(ok({ removed: true })); });

module.exports = { list, get, create, update, remove, assign, start, complete, updateStop, reroute, listTemplates, saveTemplate, removeTemplate };
