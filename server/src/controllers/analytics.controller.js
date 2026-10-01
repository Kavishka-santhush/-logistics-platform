const svc = require('../services/analytics.service');
const { h } = require('../utils/asyncHandler.util');
const { ok } = require('../utils/response.util');

const overview = h(async (req, res) => res.json(ok(await svc.overview(req.organizationId, req.query))));
const timeseries = h(async (req, res) => res.json(ok(await svc.timeseries(req.organizationId, req.query))));
const orderStatusBreakdown = h(async (req, res) => res.json(ok(await svc.orderStatusBreakdown(req.organizationId))));
const topCustomers = h(async (req, res) => res.json(ok(await svc.topCustomers(req.organizationId, req.query))));
const driverLeaderboard = h(async (req, res) => res.json(ok(await svc.driverLeaderboard(req.organizationId, req.query))));
const fleetUtilization = h(async (req, res) => res.json(ok(await svc.fleetUtilization(req.organizationId))));
const onTimeRate = h(async (req, res) => res.json(ok(await svc.onTimeRate(req.organizationId, { start: req.query.from ? new Date(req.query.from) : new Date(Date.now() - 30 * 864e5), end: req.query.to ? new Date(req.query.to) : new Date() }))));
const costSummary = h(async (req, res) => res.json(ok(await svc.costSummary(req.organizationId, req.query))));
const revenue = h(async (req, res) => res.json(ok(await svc.revenue(req.organizationId, { start: req.query.from ? new Date(req.query.from) : new Date(Date.now() - 30 * 864e5), end: req.query.to ? new Date(req.query.to) : new Date() }))));
const snapshots = h(async (req, res) => res.json(ok(await svc.listSnapshots(req.organizationId, req.query))));

module.exports = { overview, timeseries, orderStatusBreakdown, topCustomers, driverLeaderboard, fleetUtilization, onTimeRate, costSummary, revenue, snapshots };
