const svc = require('../services/organization.service');
const { h } = require('../utils/asyncHandler.util');
const { ok, created } = require('../utils/response.util');

const get = h(async (req, res) => res.json(ok(await svc.get(req.organizationId))));
const update = h(async (req, res) => res.json(ok(await svc.update(req.organizationId, req.body))));
const listAll = h(async (req, res) => res.json(ok(await svc.listAll(req.query)))); // super-admin
const create = h(async (req, res) => res.status(201).json(created(await svc.create(req.body, { actorId: req.userId }))));

const listBranches = h(async (req, res) => res.json(ok(await svc.listBranches(req.organizationId))));
const createBranch = h(async (req, res) => res.status(201).json(created(await svc.createBranch(req.organizationId, req.body))));
const updateBranch = h(async (req, res) => res.json(ok(await svc.updateBranch(req.organizationId, req.params.id, req.body))));
const removeBranch = h(async (req, res) => { await svc.removeBranch(req.organizationId, req.params.id); res.json(ok({ removed: true })); });

const setSubscription = h(async (req, res) => res.json(ok(await svc.setSubscription(req.organizationId, req.body))));
const getPlan = h(async (req, res) => res.json(ok(await svc.getPlan(req.params.tier))));
const listPlans = h(async (_req, res) => res.json(ok(await svc.listPlans())));

module.exports = { get, update, listAll, create, listBranches, createBranch, updateBranch, removeBranch, setSubscription, getPlan, listPlans };
