const svc = require('../services/driver.service');
const { h } = require('../utils/asyncHandler.util');
const { ok, created, paginated } = require('../utils/response.util');

const list = h(async (req, res) => { const r = await svc.list(req.organizationId, req.query); res.json(paginated(r.data, r)); });
const get = h(async (req, res) => res.json(ok(await svc.get(req.organizationId, req.params.id))));
const me = h(async (req, res) => res.json(ok(await svc.getByUserId(req.userId))));
const create = h(async (req, res) => res.status(201).json(created(await svc.create(req.organizationId, req.body))));
const update = h(async (req, res) => res.json(ok(await svc.update(req.organizationId, req.params.id, req.body))));
const remove = h(async (req, res) => { await svc.remove(req.organizationId, req.params.id); res.json(ok({ removed: true })); });

const setStatus = h(async (req, res) => res.json(ok(await svc.setStatus(req.organizationId, req.params.id, req.body))));
const setSuspended = h(async (req, res) => res.json(ok(await svc.setSuspended(req.organizationId, req.params.id, req.body))));
const resetPin = h(async (req, res) => res.json(ok(await svc.resetPin(req.organizationId, req.params.id))));
const performance = h(async (req, res) => res.json(ok(await svc.computePerformance(req.organizationId, req.params.id))));

const requestLeave = h(async (req, res) => res.status(201).json(created(await svc.requestLeave(req.organizationId, req.params.id, req.body))));
const approveLeave = h(async (req, res) => res.json(ok(await svc.approveLeave(req.organizationId, req.params.leaveId, { ...req.body, approverId: req.userId }))));

const setShifts = h(async (req, res) => res.json(ok(await svc.setShifts(req.organizationId, req.params.id, req.body.shifts || req.body))));
const addDrivingMinutes = h(async (req, res) => res.json(ok(await svc.addDrivingMinutes(req.organizationId, req.params.id, Number(req.body.minutes)))));

module.exports = { list, get, me, create, update, remove, setStatus, setSuspended, resetPin, performance, requestLeave, approveLeave, setShifts, addDrivingMinutes };
