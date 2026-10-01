const svc = require('../services/maintenance.service');
const { h } = require('../utils/asyncHandler.util');
const { ok, created, paginated } = require('../utils/response.util');

const list = h(async (req, res) => { const r = await svc.list(req.organizationId, req.query); res.json(paginated(r.data, r)); });
const get = h(async (req, res) => res.json(ok(await svc.get(req.organizationId, req.params.id))));
const createWorkOrder = h(async (req, res) => res.status(201).json(created(await svc.createWorkOrder(req.organizationId, req.body))));
const updateWorkOrder = h(async (req, res) => res.json(ok(await svc.updateWorkOrder(req.organizationId, req.params.id, req.body))));
const completeService = h(async (req, res) => res.json(ok(await svc.completeService(req.organizationId, req.params.id, req.body))));

const createSchedule = h(async (req, res) => res.status(201).json(created(await svc.createSchedule(req.organizationId, req.body))));
const listSchedules = h(async (req, res) => res.json(ok(await svc.listSchedules(req.organizationId, req.query))));
const dueSchedules = h(async (req, res) => res.json(ok(await svc.dueSchedules(req.organizationId, req.query))));

const listVendors = h(async (req, res) => { const r = await svc.listVendors(req.organizationId, req.query); res.json(paginated(r.data, r)); });
const createVendor = h(async (req, res) => res.status(201).json(created(await svc.createVendor(req.organizationId, req.body))));
const updateVendor = h(async (req, res) => res.json(ok(await svc.updateVendor(req.organizationId, req.params.id, req.body))));

const costByVehicle = h(async (req, res) => res.json(ok(await svc.costByVehicle(req.organizationId, req.query))));
const kpis = h(async (req, res) => res.json(ok(await svc.kpis(req.organizationId))));

module.exports = { list, get, createWorkOrder, updateWorkOrder, completeService, createSchedule, listSchedules, dueSchedules, listVendors, createVendor, updateVendor, costByVehicle, kpis };
