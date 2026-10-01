const prisma = require('../lib/prisma');
const { crud } = require('../lib/crud');
const { notFound, badRequest } = require('../utils/response.util');
const notificationService = require('./notification.service');

const base = crud('driver');
const list = (orgId, opts) => base.list(orgId, opts);
const remove = (orgId, id) => base.remove(orgId, id);

async function get(orgId, id) {
  const d = await prisma.driver.findFirst({
    where: { id, organizationId: orgId },
    include: { branch: true, vehicles: { select: { id: true, plateNumber: true, type: true } }, documents: true, trainings: true, performanceHistory: { orderBy: [{ year: 'desc' }, { month: 'desc' }], take: 12 } },
  });
  if (!d) throw notFound('Driver');
  return d;
}

/** Create a driver, optionally linking/creating an auth user for the mobile app. */
async function create(orgId, data) {
  return prisma.driver.create({
    data: {
      ...data,
      organizationId,
      joinDate: data.joinDate ? new Date(data.joinDate) : new Date(),
      licenseIssueDate: data.licenseIssueDate ? new Date(data.licenseIssueDate) : undefined,
      licenseExpiryDate: data.licenseExpiryDate ? new Date(data.licenseExpiryDate) : undefined,
    },
  });
}

/** Resolve the driver profile linked to an auth user (mobile app bootstrap). */
async function getByUserId(userId) {
  const d = await prisma.driver.findFirst({
    where: { userId },
    include: { branch: { select: { id: true, name: true } }, vehicles: { select: { id: true, plateNumber: true, type: true } } },
  });
  if (!d) throw notFound('Driver profile');
  return d;
}

async function update(orgId, id, data) {
  await ensure(orgId, id);
  return prisma.driver.update({ where: { id }, data });
}

async function setStatus(orgId, id, status) {
  await ensure(orgId, id);
  return prisma.driver.update({ where: { id }, data: { status } });
}

/** Suspend or reactivate a driver account (+ revoke mobile access on suspend). */
async function setSuspended(orgId, id, { suspended, reason }) {
  await ensure(orgId, id);
  return prisma.driver.update({
    where: { id },
    data: {
      isSuspended: suspended,
      suspensionReason: suspended ? reason : null,
      status: suspended ? 'SUSPENDED' : 'AVAILABLE',
      appAccessRevoked: suspended,
    },
  });
}

/** Reset the mobile PIN (placeholder — stores hash server-side in prod). */
async function resetPin(orgId, id) {
  const driver = await ensure(orgId, id);
  if (driver.userId) await prisma.user.update({ where: { id: driver.userId }, data: { passwordPin: null } });
  return { ok: true };
}

/** Aggregate driver performance score (0-100). */
async function computePerformance(orgId, id) {
  await ensure(orgId, id);
  const since = new Date(Date.now() - 90 * 24 * 3600 * 1000);
  const [total, delivered, failed, ratings, violations] = await Promise.all([
    prisma.order.count({ where: { assignedDriverId: id, createdAt: { gte: since } } }),
    prisma.order.count({ where: { assignedDriverId: id, status: 'DELIVERED', createdAt: { gte: since } } }),
    prisma.order.count({ where: { assignedDriverId: id, status: 'FAILED', createdAt: { gte: since } } }),
    prisma.deliveryRating.aggregate({ where: { driverId: id, createdAt: { gte: since } }, _avg: { stars: true, punctuality: true }, _count: { _all: true } }),
    prisma.geofenceAlert.count({ where: { driverId: id, triggeredAt: { gte: since } } }),
  ]);
  const onTimeRate = total ? Number(((delivered / total) * 100).toFixed(1)) : 0;
  const successRate = total ? Number(((delivered / (delivered + failed || 1)) * 100).toFixed(1)) : 0;
  const ratingScore = ((ratings._avg.stars || 0) / 5) * 100;
  const violationPenalty = Math.min(30, violations * 3);
  const score = Number((onTimeRate * 0.4 + successRate * 0.3 + ratingScore * 0.3 - violationPenalty).toFixed(1));

  const updated = await prisma.driver.update({
    where: { id },
    data: { onTimeRate, successRate, ratingAvg: ratings._avg.stars || 0, ratingCount: ratings._count || 0, violationCount: violations, performanceScore: Math.max(0, score) },
  });
  return { onTimeRate, successRate, avgRating: ratings._avg.stars, violations, score: Math.max(0, score), updatedAt: new Date() };
}

// ── Leave management ──────────────────────────────────────────────────────────
async function requestLeave(orgId, driverId, data) {
  await ensure(orgId, driverId);
  return prisma.driverLeave.create({
    data: { driverId, startDate: new Date(data.startDate), endDate: new Date(data.endDate), type: data.type, reason: data.reason },
  });
}

async function approveLeave(orgId, leaveId, { approve, approverId }) {
  const leave = await prisma.driverLeave.findFirst({ where: { id: leaveId, driver: { organizationId: orgId } } });
  if (!leave) throw notFound('Leave request');
  const updated = await prisma.driverLeave.update({
    where: { id: leaveId },
    data: { status: approve ? 'APPROVED' : 'REJECTED', approvedBy: approverId, approvedAt: new Date() },
  });
  if (approve) await prisma.driver.update({ where: { id: leave.driverId }, data: { status: 'ON_LEAVE' } });
  return updated;
}

// ── Shifts (duty roster) ──────────────────────────────────────────────────────
async function setShifts(orgId, driverId, shifts) {
  await ensure(orgId, driverId);
  await prisma.driverShift.deleteMany({ where: { driverId, shiftDate: { gte: new Date(shifts[0]?.date || 0) } } });
  return prisma.driverShift.createMany({
    data: shifts.map((s) => ({ organizationId: orgId, driverId, shiftDate: new Date(s.date), startTime: s.startTime, endTime: s.endTime, label: s.label, branchId: s.branchId })),
  });
}

// ── HOS (hours of service) ──────────────────────────────────────────────────
/** Add driving minutes today, resetting the daily counter as needed. */
async function addDrivingMinutes(orgId, driverId, minutes) {
  const driver = await ensure(orgId, driverId);
  const now = new Date();
  const resetNeeded = !driver.hosResetAt || now - new Date(driver.hosResetAt) > 24 * 3600 * 1000;
  const base2 = resetNeeded ? 0 : driver.todayDrivingMinutes;
  const total = base2 + minutes;
  const updated = await prisma.driver.update({
    where: { id: driverId },
    data: { todayDrivingMinutes: total, hosResetAt: resetNeeded ? now : driver.hosResetAt },
  });
  const overLimit = total > Number(driver.hoursLimitDaily) * 60;
  if (overLimit) {
    await prisma.hoursOfServiceLog.upsert({
      where: { driverId_logDate: { driverId, logDate: new Date(now.toISOString().slice(0, 10)) } },
      update: { drivingMinutes: total, violations: [{ type: 'DAILY_HOURS_EXCEEDED', at: now.toISOString(), limit: Number(driver.hoursLimitDaily) }] },
      create: { driverId, logDate: new Date(now.toISOString().slice(0, 10)), drivingMinutes: total, violations: [{ type: 'DAILY_HOURS_EXCEEDED', at: now.toISOString(), limit: Number(driver.hoursLimitDaily) }] },
    });
  }
  return { todayDrivingMinutes: total, limitHours: Number(driver.hoursLimitDaily), overLimit };
}

/** Drivers whose license expires within the given day window (for cron alerts). */
async function licensesExpiringWithin(days) {
  const until = new Date(Date.now() + days * 24 * 3600 * 1000);
  return prisma.driver.findMany({
    where: { licenseExpiryDate: { lte: until, gte: new Date() }, isSuspended: false },
    select: { id: true, name: true, licenseExpiryDate: true, organizationId: true },
  });
}

async function ensure(orgId, id) {
  const d = await prisma.driver.findFirst({ where: { id, organizationId: orgId } });
  if (!d) throw notFound('Driver');
  return d;
}

module.exports = { list, get, getByUserId, create, update, remove, setStatus, setSuspended, resetPin, computePerformance, requestLeave, approveLeave, setShifts, addDrivingMinutes, licensesExpiringWithin };
