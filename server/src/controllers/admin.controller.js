const svc = require('../services/admin.service');
const { h } = require('../utils/asyncHandler.util');
const { ok, created, paginated } = require('../utils/response.util');

const platformStats = h(async (req, res) => res.json(ok(await svc.platformStats())));

const listOrganizations = h(async (req, res) => { const r = await svc.listOrganizations(req.query); res.json(paginated(r.data, r)); });
const getOrganization = h(async (req, res) => res.json(ok(await svc.getOrganization(req.params.id))));
const createOrganization = h(async (req, res) => res.status(201).json(created(await svc.createOrganization(req.body, { actorId: req.userId }))));
const updateOrganization = h(async (req, res) => res.json(ok(await svc.updateOrganization(req.params.id, req.body))));
const setActive = h(async (req, res) => res.json(ok(await svc.setOrganizationActive(req.params.id, req.body.isActive, { actorId: req.userId }))));
const setSubscription = h(async (req, res) => res.json(ok(await svc.setSubscription(req.params.id, req.body, { actorId: req.userId }))));

const listPlans = h(async (req, res) => res.json(ok(await svc.listPlans())));
const upsertPlan = h(async (req, res) => res.json(ok(await svc.upsertPlan(req.body))));

const listUsers = h(async (req, res) => { const r = await svc.listUsers(req.query); res.json(paginated(r.data, r)); });
const setUserStatus = h(async (req, res) => res.json(ok(await svc.setUserStatus(req.params.id, req.body.status))));
const setUserRole = h(async (req, res) => res.json(ok(await svc.setUserRole(req.params.id, req.body.role, req.body.organizationId)))
);

const auditLogs = h(async (req, res) => { const r = await svc.auditLogs(req.query); res.json(paginated(r.data, r)); });
const systemHealth = h(async (req, res) => res.json(ok(await svc.systemHealth())));

module.exports = { platformStats, listOrganizations, getOrganization, createOrganization, updateOrganization, setActive, setSubscription, listPlans, upsertPlan, listUsers, setUserStatus, setUserRole, auditLogs, systemHealth };
