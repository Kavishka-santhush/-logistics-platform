const svc = require('../services/tracking.service');
const { h } = require('../utils/asyncHandler.util');
const { ok } = require('../utils/response.util');

const ingest = h(async (req, res) => res.json(ok(await svc.ingestPoint({ ...req.body, organizationId: req.organizationId }))));
const liveFleet = h(async (req, res) => res.json(ok(await svc.liveFleet(req.organizationId))));
const trail = h(async (req, res) => res.json(ok(await svc.trail(req.organizationId, req.params.vehicleId, req.query))));
const playback = h(async (req, res) => res.json(ok(await svc.playback(req.organizationId, req.query))));
const publicTrack = h(async (req, res) => res.json(ok(await svc.publicTrack(req.params.trackingNumber))));

module.exports = { ingest, liveFleet, trail, playback, publicTrack };
