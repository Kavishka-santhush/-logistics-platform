const svc = require('../services/inventory.service');
const { h } = require('../utils/asyncHandler.util');
const { ok, created, paginated } = require('../utils/response.util');

const list = h(async (req, res) => { const r = await svc.list(req.organizationId, req.query); res.json(paginated(r.data, r)); });
const get = h(async (req, res) => res.json(ok(await svc.get(req.organizationId, req.params.id))));
const create = h(async (req, res) => res.status(201).json(created(await svc.create(req.organizationId, req.body))));
const update = h(async (req, res) => res.json(ok(await svc.update(req.organizationId, req.params.id, req.body))));
const remove = h(async (req, res) => { await svc.remove(req.organizationId, req.params.id); res.json(ok({ removed: true })); });

const search = h(async (req, res) => { const r = await svc.search(req.organizationId, req.query); res.json(r.data ? paginated(r.data, r) : ok(r)); });
const scan = h(async (req, res) => res.json(ok(await svc.scan(req.organizationId, req.params.code))));
const move = h(async (req, res) => res.json(ok(await svc.move(req.organizationId, req.body))));
const adjust = h(async (req, res) => res.json(ok(await svc.adjust(req.organizationId, { ...req.body, adjustedBy: req.userId }))));
const transfer = h(async (req, res) => res.json(ok(await svc.transfer(req.organizationId, req.body))));
const lowStock = h(async (req, res) => res.json(ok(await svc.lowStock(req.organizationId))));
const createTask = h(async (req, res) => res.status(201).json(created(await svc.createTask(req.organizationId, req.body))));
const updateTask = h(async (req, res) => res.json(ok(await svc.updateTask(req.organizationId, req.params.id, req.body))));

module.exports = { list, get, create, update, remove, search, scan, move, adjust, transfer, lowStock, createTask, updateTask };
