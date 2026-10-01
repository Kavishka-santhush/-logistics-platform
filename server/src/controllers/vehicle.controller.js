const svc = require('../services/vehicle.service');
const { h } = require('../utils/asyncHandler.util');
const { ok, created, paginated } = require('../utils/response.util');

const INCLUDE = { branch: { select: { id: true, name: true } }, assignedDriver: { select: { id: true, name: true } } };

const list = h(async (req, res) => {
  const r = await svc.list(req.organizationId, { ...req.query, include: INCLUDE });
  res.json(paginated(r.data, r));
});

const get = h(async (req, res) => res.json(ok(await svc.get(req.organizationId, req.params.id))));

const create = h(async (req, res) => res.status(201).json(created(await svc.create(req.organizationId, req.body))));

const update = h(async (req, res) => res.json(ok(await svc.update(req.organizationId, req.params.id, req.body))));

const remove = h(async (req, res) => { await svc.remove(req.organizationId, req.params.id); res.json(ok({ removed: true })); });

const setStatus = h(async (req, res) => res.json(ok(await svc.setStatus(req.organizationId, req.params.id, req.body))));

const assign = h(async (req, res) => res.json(ok(await svc.assign(req.organizationId, req.params.id, req.body))));

const recordTelematics = h(async (req, res) => res.json(ok(await svc.recordTelematics(req.organizationId, req.params.id, req.body))));

const costOfOwnership = h(async (req, res) => res.json(ok(await svc.costOfOwnership(req.organizationId, req.params.id))));

const utilization = h(async (req, res) => res.json(ok(await svc.utilization(req.organizationId, req.query))));

module.exports = { list, get, create, update, remove, setStatus, assign, recordTelematics, costOfOwnership, utilization };
