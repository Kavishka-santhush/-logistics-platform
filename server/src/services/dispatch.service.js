const prisma = require('../lib/prisma');
const { notFound, badRequest, forbidden } = require('../utils/response.util');
const notificationService = require('./notification.service');

function emitToOrg(orgId, event, payload) {
  try {
    require('../socket').emitToOrg(orgId, event, payload);
  } catch (_) {
    /* socket not ready */
  }
}

/**
 * Assign a driver + vehicle to an order (single dispatch) and notify the driver.
 */
async function assign({ organizationId, orderId, driverId, vehicleId, routeId, emergency = false, notes, createdBy }) {
  const order = await prisma.order.findFirst({ where: { id: orderId, organizationId } });
  if (!order) throw notFound('Order');
  if (['DELIVERED', 'CANCELLED'].includes(order.status)) throw badRequest(`Cannot dispatch ${order.status.toLowerCase()} order`);

  const [driver, vehicle] = await Promise.all([
    prisma.driver.findFirst({ where: { id: driverId, organizationId } }),
    vehicleId ? prisma.vehicle.findFirst({ where: { id: vehicleId, organizationId } }) : Promise.resolve(null),
  ]);
  if (!driver) throw notFound('Driver');
  if (driver.isSuspended) throw badRequest('Driver is suspended');
  if (vehicleId && !vehicle) throw notFound('Vehicle');
  if (vehicle && !vehicle.isAvailable && !emergency) throw badRequest('Vehicle is not available');

  const dispatch = await prisma.dispatch.create({
    data: { organizationId, orderId, driverId, vehicleId: vehicleId || null, routeId: routeId || null, emergency, notes, createdBy, mode: emergency ? 'EMERGENCY' : 'SINGLE_ORDER' },
  });

  await prisma.order.update({
    where: { id: orderId },
    data: { assignedDriverId: driverId, assignedVehicleId: vehicleId || null, status: 'ASSIGNED', routeId: routeId || order.routeId },
  });
  if (vehicle) await prisma.vehicle.update({ where: { id: vehicle.id }, data: { status: 'ON_DELIVERY' } });

  // Notify the driver's account (push + in-app + realtime)
  if (driver.userId) {
    await notificationService.notifyUser({
      userId: driver.userId,
      organizationId,
      type: 'ASSIGNMENT',
      title: 'New delivery assignment',
      body: `You have been assigned order ${order.orderNumber}`,
      payload: { dispatchId: dispatch.id, orderId, trackingNumber: order.trackingNumber },
      forcePush: true,
    });
  }

  emitToOrg(organizationId, 'dispatch:created', dispatch);
  emitToOrg(organizationId, 'order:updated', { id: orderId, status: 'ASSIGNED' });
  return dispatch;
}

/** Bulk assign several orders to a driver/vehicle. */
async function bulkAssign({ organizationId, orderIds, driverId, vehicleId, createdBy, notes }) {
  const results = [];
  for (const orderId of orderIds) {
    try {
      results.push({ orderId, ok: true, dispatch: await assign({ organizationId, orderId, driverId, vehicleId, createdBy, notes }) });
    } catch (err) {
      results.push({ orderId, ok: false, error: err.message });
    }
  }
  return results;
}

/** Driver accepts or rejects an assignment (called from socket). */
async function respond({ dispatchId, driverId, action, reason }) {
  const dispatch = await prisma.dispatch.findUnique({ where: { id: dispatchId }, include: { order: true, driver: { include: { user: true } } } });
  if (!dispatch) throw notFound('Dispatch');
  if (dispatch.driverId !== driverId) throw forbidden('Not your assignment');
  if (dispatch.status !== 'PENDING') throw badRequest('Already responded');

  if (action === 'accept') {
    await prisma.dispatch.update({ where: { id: dispatchId }, data: { status: 'ACCEPTED', acceptedAt: new Date() } });
    if (dispatch.orderId) await prisma.orderEvent.create({ data: { orderId: dispatch.orderId, status: 'ASSIGNED', note: 'Driver accepted assignment' } });
    await notificationService.notifyUser({
      userId: dispatch.driver.user?.id,
      organizationId: dispatch.organizationId,
      type: 'ASSIGNMENT_ACCEPTED',
      title: 'Assignment accepted',
      body: `Driver ${dispatch.driver.name} accepted order`,
      payload: { dispatchId },
    });
  } else if (action === 'reject') {
    await prisma.dispatch.update({ where: { id: dispatchId }, data: { status: 'REJECTED', rejectedReason: reason } });
    if (dispatch.orderId) {
      await prisma.order.update({ where: { id: dispatch.orderId }, data: { status: 'CONFIRMED', assignedDriverId: null, assignedVehicleId: null } });
    }
    await prisma.driver.update({ where: { id: driverId }, data: { status: 'AVAILABLE' } });
  } else {
    throw badRequest('action must be accept or reject');
  }

  return {
    organizationId: dispatch.organizationId,
    dispatchId,
    orderId: dispatch.orderId,
    status: action === 'accept' ? 'ACCEPTED' : 'REJECTED',
    driverId,
  };
}

/** End-of-day dispatch report. */
async function daySummary(organizationId, date = new Date()) {
  const start = new Date(date); start.setHours(0, 0, 0, 0);
  const end = new Date(date); end.setHours(23, 59, 59, 999);
  const where = { organizationId, dispatchedAt: { gte: start, lte: end } };
  const [dispatched, completed, failed, pending] = await Promise.all([
    prisma.dispatch.count({ where }),
    prisma.order.count({ where: { organizationId, status: 'DELIVERED', deliveredAt: { gte: start, lte: end } } }),
    prisma.order.count({ where: { organizationId, status: 'FAILED', failedAt: { gte: start, lte: end } } }),
    prisma.dispatch.count({ where: { ...where, status: 'PENDING' } }),
  ]);
  return { date: start, dispatched, completed, failed, pending };
}

/** Dispatcher → driver message (persist + return payload for realtime emit). */
async function sendDriverMessage({ organizationId, senderId, driverId, body, orderId }) {
  const driver = await prisma.driver.findFirst({ where: { id: driverId, organizationId } });
  if (!driver) throw notFound('Driver');
  return prisma.driverMessage.create({
    data: { driverId, senderId, receiverId: driver.userId, body, orderId, isFromDriver: false },
  });
}

async function sendDriverReply({ driverId, body, orderId }) {
  const driver = await prisma.driver.findUnique({ where: { id: driverId }, include: { user: true } });
  if (!driver) throw notFound('Driver');
  return prisma.driverMessage.create({
    data: { driverId, senderId: driver.userId, body, orderId, isFromDriver: true },
  });
}

async function conversation(organizationId, driverId) {
  const driver = await prisma.driver.findFirst({ where: { id: driverId, organizationId } });
  if (!driver) throw notFound('Driver');
  return prisma.driverMessage.findMany({ where: { driverId }, orderBy: { createdAt: 'asc' }, take: 200 });
}

/** Pending assignment offers for a driver (mobile app inbox). */
async function pendingForDriver(organizationId, driverId) {
  return prisma.dispatch.findMany({
    where: { organizationId, driverId, status: 'PENDING' },
    include: {
      order: { select: { id: true, orderNumber: true, trackingNumber: true, status: true, deliveryAddressLine: true, deliveryCity: true, codAmount: true, currency: true } },
      vehicle: { select: { id: true, plateNumber: true, type: true } },
      route: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
}

/** Dispatch board: unassigned orders + drivers/vehicles + today's routes. */
async function board(organizationId, date = new Date()) {
  const start = new Date(date); start.setHours(0, 0, 0, 0);
  const end = new Date(date); end.setHours(23, 59, 59, 999);
  const [unassigned, drivers, vehicles, routes, activeDispatches] = await Promise.all([
    prisma.order.findMany({
      where: { organizationId, status: 'CONFIRMED', assignedDriverId: null, scheduledDeliveryAt: { lte: end } },
      orderBy: [{ priority: 'desc' }, { scheduledDeliveryAt: 'asc' }],
      include: { customer: { select: { companyName: true, tier: true } } },
    }),
    prisma.driver.findMany({
      where: { organizationId, isSuspended: false },
      select: { id: true, name: true, status: true, todayDrivingMinutes: true, hoursLimitDaily: true, ratingAvg: true, assignedVehicle: { select: { id: true, plateNumber: true } } },
    }),
    prisma.vehicle.findMany({
      where: { organizationId },
      select: { id: true, plateNumber: true, type: true, status: true, isAvailable: true, weightCapacityKg: true },
    }),
    prisma.route.findMany({
      where: { organizationId, date: { gte: start, lte: end } },
      include: { stops: { orderBy: { sequence: 'asc' } }, driver: { select: { name: true } }, vehicle: { select: { plateNumber: true } } },
    }),
    prisma.dispatch.findMany({
      where: { organizationId, status: 'ACCEPTED' },
      include: { order: { select: { orderNumber: true, status: true, trackingNumber: true } } },
    }),
  ]);
  return { unassigned, drivers, vehicles, routes, activeDispatches };
}

module.exports = { assign, bulkAssign, respond, daySummary, sendDriverMessage, sendDriverReply, conversation, pendingForDriver, board };
