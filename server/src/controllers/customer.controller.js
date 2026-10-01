const svc = require('../services/customer.service');
const { h } = require('../utils/asyncHandler.util');
const { ok, created, paginated } = require('../utils/response.util');

const list = h(async (req, res) => { const r = await svc.list(req.organizationId, req.query); res.json(paginated(r.data, r)); });
const search = h(async (req, res) => res.json(ok(await svc.search(req.organizationId, req.query.q))));
const stats = h(async (req, res) => res.json(ok(await svc.stats(req.organizationId))));
const get = h(async (req, res) => res.json(ok(await svc.get(req.organizationId, req.params.id))));
const create = h(async (req, res) => res.status(201).json(created(await svc.create(req.organizationId, req.body))));
const update = h(async (req, res) => res.json(ok(await svc.update(req.organizationId, req.params.id, req.body))));
const archive = h(async (req, res) => res.json(ok(await svc.archive(req.organizationId, req.params.id))));

const listAddresses = h(async (req, res) => res.json(ok(await svc.listAddresses(req.organizationId, req.params.id))));
const addAddress = h(async (req, res) => res.status(201).json(created(await svc.addAddress(req.organizationId, req.params.id, req.body))));
const removeAddress = h(async (req, res) => { await svc.removeAddress(req.organizationId, req.params.id, req.params.addressId); res.json(ok({ removed: true })); });

const listContracts = h(async (req, res) => res.json(ok(await svc.listContracts(req.organizationId, req.params.id))));
const addContract = h(async (req, res) => res.status(201).json(created(await svc.addContract(req.organizationId, req.params.id, req.body))));

const performance = h(async (req, res) => res.json(ok(await svc.performance(req.organizationId, req.params.id, req.query))));
const orderTrend = h(async (req, res) => res.json(ok(await svc.orderTrend(req.organizationId, req.params.id, Number(req.query.months) || 6))));

module.exports = { list, search, stats, get, create, update, archive, listAddresses, addAddress, removeAddress, listContracts, addContract, performance, orderTrend };
