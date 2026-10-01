const svc = require('../services/order.service');
const { h } = require('../utils/asyncHandler.util');
const { ok, created, paginated } = require('../utils/response.util');

const list = h(async (req, res) => { const r = await svc.list(req.organizationId, req.query); res.json(paginated(r.data, r)); });

const search = h(async (req, res) => { const r = await svc.search(req.organizationId, req.query); res.json(r.data ? paginated(r.data, r) : ok(r)); });

const get = h(async (req, res) => res.json(ok(await svc.get(req.organizationId, req.params.id))));

const create = h(async (req, res) => res.status(201).json(created(await svc.create(req.organizationId, req.body, { createdBy: req.userId }))));

const updateStatus = h(async (req, res) => res.json(ok(await svc.updateStatus(req.organizationId, req.params.id, { ...req.body, actorId: req.userId }))));

const recordPod = h(async (req, res) => res.json(ok(await svc.recordPod(req.organizationId, req.params.id, req.body))));

const reschedule = h(async (req, res) => res.json(ok(await svc.reschedule(req.organizationId, req.params.id, req.body))));

const createReturn = h(async (req, res) => res.status(201).json(created(await svc.createReturn(req.organizationId, req.params.id))));

const clone = h(async (req, res) => res.status(201).json(created(await svc.clone(req.organizationId, req.params.id, { createdBy: req.userId }))));

const reconcileCod = h(async (req, res) => res.json(ok(await svc.reconcileCod(req.organizationId, req.params.id, req.body))));

module.exports = { list, search, get, create, updateStatus, recordPod, reschedule, createReturn, clone, reconcileCod };
