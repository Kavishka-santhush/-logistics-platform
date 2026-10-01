const prisma = require('../lib/prisma');
const svc = require('../services/dispatch.service');
const { h } = require('../utils/asyncHandler.util');
const { ok, created, forbidden, notFound } = require('../utils/response.util');

const assign = h(async (req, res) => res.status(201).json(created(await svc.assign({ organizationId: req.organizationId, ...req.body, createdBy: req.userId }))));
const bulkAssign = h(async (req, res) => res.json(ok(await svc.bulkAssign({ organizationId: req.organizationId, ...req.body, createdBy: req.userId }))));
const daySummary = h(async (req, res) => res.json(ok(await svc.daySummary(req.organizationId, req.query.date))));
const board = h(async (req, res) => res.json(ok(await svc.board(req.organizationId, req.query.date))));
const conversation = h(async (req, res) => res.json(ok(await svc.conversation(req.organizationId, req.params.driverId))));
const sendMessage = h(async (req, res) => res.status(201).json(created(await svc.sendDriverMessage({ organizationId: req.organizationId, senderId: req.userId, ...req.body }))));

/** Driver → dispatcher reply. The authenticated user must own the driver profile. */
const sendReply = h(async (req, res) => {
  const driver = await prisma.driver.findFirst({
    where: { id: req.params.driverId, organizationId: req.organizationId },
    select: { id: true, userId: true },
  });
  if (!driver) throw notFound('Driver');
  if (req.user.role !== 'SUPER_ADMIN' && driver.userId !== req.userId) throw forbidden('Not your driver profile');
  const msg = await svc.sendDriverReply({ driverId: driver.id, ...req.body });
  res.status(201).json(created(msg));
});

/** Assignment offers awaiting this driver's response (mobile inbox). */
const pendingForMe = h(async (req, res) => {
  const driver = await prisma.driver.findFirst({
    where: { id: req.params.driverId, organizationId: req.organizationId },
    select: { id: true, userId: true },
  });
  if (!driver) throw notFound('Driver');
  if (req.user.role !== 'SUPER_ADMIN' && driver.userId !== req.userId) throw forbidden('Not your driver profile');
  res.json(ok(await svc.pendingForDriver(req.organizationId, driver.id)));
});

module.exports = { assign, bulkAssign, daySummary, board, conversation, sendMessage, sendReply, pendingForMe };
