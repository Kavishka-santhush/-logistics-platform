const svc = require('../services/fleet.service');
const { h } = require('../utils/asyncHandler.util');
const { ok } = require('../utils/response.util');

const overview = h(async (req, res) => res.json(ok(await svc.overview(req.organizationId))));
const costSummary = h(async (req, res) => res.json(ok(await svc.costSummary(req.organizationId, req.query))));

module.exports = { overview, costSummary };
