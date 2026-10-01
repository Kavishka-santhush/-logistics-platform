const svc = require('../services/invoice.service');
const { h } = require('../utils/asyncHandler.util');
const { ok, created, paginated } = require('../utils/response.util');

const list = h(async (req, res) => { const r = await svc.list(req.organizationId, req.query); res.json(paginated(r.data, r)); });
const get = h(async (req, res) => res.json(ok(await svc.get(req.organizationId, req.params.id))));

const generate = h(async (req, res) => res.status(201).json(created(await svc.generate(req.organizationId, req.body))));
const generateAll = h(async (req, res) => res.status(201).json(created(await svc.generateAll(req.organizationId))));
const update = h(async (req, res) => res.json(ok(await svc.update(req.organizationId, req.params.id, req.body))));

const addLine = h(async (req, res) => res.json(ok(await svc.addLine(req.organizationId, req.params.id, req.body))));
const removeLine = h(async (req, res) => res.json(ok(await svc.removeLine(req.organizationId, req.params.id, req.params.lineId))));

const send = h(async (req, res) => res.json(ok(await svc.send(req.organizationId, req.params.id, req.body))));
const cancel = h(async (req, res) => res.json(ok(await svc.cancel(req.organizationId, req.params.id))));
const renderPdf = h(async (req, res) => res.json(ok(await svc.renderPdf(req.organizationId, req.params.id))));

const recordPayment = h(async (req, res) => res.json(ok(await svc.recordPayment(req.organizationId, req.params.id, { ...req.body, recordedBy: req.userId }))));
const createPaymentLink = h(async (req, res) => res.json(ok(await svc.createPaymentLink(req.organizationId, req.params.id))));
const refundPayment = h(async (req, res) => res.json(ok(await svc.refundPayment(req.organizationId, req.params.paymentId))));
const issueCreditNote = h(async (req, res) => res.status(201).json(created(await svc.issueCreditNote(req.organizationId, req.params.id, req.body))));

const agingReport = h(async (req, res) => res.json(ok(await svc.agingReport(req.organizationId))));
const kpis = h(async (req, res) => res.json(ok(await svc.kpis(req.organizationId))));

module.exports = { list, get, generate, generateAll, update, addLine, removeLine, send, cancel, renderPdf, recordPayment, createPaymentLink, refundPayment, issueCreditNote, agingReport, kpis };
