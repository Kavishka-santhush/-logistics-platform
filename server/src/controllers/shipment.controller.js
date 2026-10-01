const svc = require('../services/shipment.service');
const { h } = require('../utils/asyncHandler.util');
const { ok } = require('../utils/response.util');

const get = h(async (req, res) => res.json(ok(await svc.get(req.params.orderId))));
const updateStatus = h(async (req, res) => res.json(ok(await svc.updateStatus(req.params.orderId, req.body))));
const timeline = h(async (req, res) => res.json(ok(await svc.timeline(req.params.orderId))));

module.exports = { get, updateStatus, timeline };
