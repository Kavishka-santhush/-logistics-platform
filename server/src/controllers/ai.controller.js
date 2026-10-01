const svc = require('../services/ai.service');
const { h } = require('../utils/asyncHandler.util');
const { ok } = require('../utils/response.util');

const org = (req) => ({ organizationId: req.organizationId, userId: req.userId });

const demandForecast = h(async (req, res) => res.json(ok(await svc.demandForecast(req.organizationId, req.body))));
const predictiveMaintenance = h(async (req, res) => res.json(ok(await svc.predictiveMaintenance(req.organizationId, req.params.vehicleId))));
const driverAnalyzer = h(async (req, res) => res.json(ok(await svc.driverAnalyzer(req.organizationId, req.params.driverId))));
const anomalyDetector = h(async (req, res) => res.json(ok(await svc.anomalyDetector(req.organizationId, req.query))));
const etaPredictor = h(async (req, res) => res.json(ok(await svc.etaPredictor(req.organizationId, req.params.orderId))));
const churnPredictor = h(async (req, res) => res.json(ok(await svc.churnPredictor(req.organizationId, req.params.customerId))));
const nlDispatch = h(async (req, res) => res.json(ok(await svc.nlDispatch(req.organizationId, req.body.instruction, { userId: req.userId }))));
const chatbot = h(async (req, res) => res.json(ok(await svc.chatbot(req.organizationId, req.body.question, { userId: req.userId, orderId: req.body.orderId, history: req.body.history }))));
const reportNarrative = h(async (req, res) => res.json(ok(await svc.reportNarrative(req.organizationId, req.query))));
const usageSummary = h(async (req, res) => res.json(ok(await svc.usageSummary(req.organizationId, req.query))));

module.exports = { demandForecast, predictiveMaintenance, driverAnalyzer, anomalyDetector, etaPredictor, churnPredictor, nlDispatch, chatbot, reportNarrative, usageSummary };
