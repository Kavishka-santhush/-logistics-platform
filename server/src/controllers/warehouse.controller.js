const svc = require('../services/warehouse.service');
const { h } = require('../utils/asyncHandler.util');
const { ok, created, paginated } = require('../utils/response.util');

const list = h(async (req, res) => { const r = await svc.list(req.organizationId, req.query); res.json(paginated(r.data, r)); });
const get = h(async (req, res) => res.json(ok(await svc.get(req.organizationId, req.params.id))));
const create = h(async (req, res) => res.status(201).json(created(await svc.create(req.organizationId, req.body))));
const update = h(async (req, res) => res.json(ok(await svc.update(req.organizationId, req.params.id, req.body))));
const remove = h(async (req, res) => { await svc.remove(req.organizationId, req.params.id); res.json(ok({ removed: true })); });
const addZone = h(async (req, res) => res.status(201).json(created(await svc.addZone(req.organizationId, req.params.id, req.body))));
const receiveInbound = h(async (req, res) => res.status(201).json(created(await svc.receiveInbound(req.organizationId, { warehouseId: req.params.id, ...req.body }))));
const crossDock = h(async (req, res) => res.json(ok(await svc.crossDock(req.organizationId, { warehouseId: req.params.id, ...req.body }))));
const performance = h(async (req, res) => res.json(ok(await svc.performance(req.organizationId, req.params.id))));

module.exports = { list, get, create, update, remove, addZone, receiveInbound, crossDock, performance };
