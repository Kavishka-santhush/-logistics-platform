const prisma = require('../lib/prisma');
const { crud } = require('../lib/crud');
const { notFound, badRequest } = require('../utils/response.util');
const ids = require('../utils/ids.util');
const { generateTrackingQr } = require('../utils/qrcode.util');
const notificationService = require('./notification.service');
const { emitToOrg } = require('../socket');

const base = crud('order');
const list = (orgId, opts) => base.list(orgId, opts);

/**
 * Full-text + trigram search with filters. Supports q (order/tracking/address),
 * status, priority, customerId, driverId, date range, branchId.
 */
async function search(orgId, { q, status, priority, customerId, driverId, vehicleId, branchId, from, to, page = 1, pageSize = 25 }) {
  const where = { organizationId: orgId };
  if (status) where.status = status;
  if (priority) where.priority = priority;
  if (customerId) where.customerId = customerId;
  if (driverId) where.assignedDriverId = driverId;
  if (vehicleId) where.assignedVehicleId = vehicleId;
  if (branchId) where.branchId = branchId;
  if (from || to) where.createdAt = { ...(from && { gte: new Date(from) }), ...(to && { lte: new Date(to) }) };
  if (q) {
    where.OR = [
      { orderNumber: { contains: q, mode: 'insensitive' } },
      { trackingNumber: { contains: q, mode: 'insensitive' } },
      { deliveryAddressLine: { contains: q, mode: 'insensitive' } },
      { deliveryCity: { contains: q, mode: 'insensitive' } },
    ];
  }
  const [data, total] = await Promise.all([
    prisma.order.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize, include: { customer: { select: { companyName: true } }, assignedDriver: { select: { name: true } }, packages: { select: { id: true, barcode: true, type: true } } } }),
    prisma.order.count({ where }),
  ]);
  return { data, total, page, pageSize };
}

async function get(orgId, id) {
  const order = await prisma.order.findFirst({
    where: { id, organizationId: orgId },
    include: {
      customer: true,
      packages: true,
      events: { orderBy: { createdAt: 'asc' } },
      notes: { orderBy: { createdAt: 'desc' } },
      proofs: { orderBy: { capturedAt: 'desc' } },
      rating: true,
      assignedDriver: { select: { id: true, name: true, phone: true } },
      assignedVehicle: { select: { id: true, plateNumber: true } },
      route: { select: { id: true, name: true } },
    },
  });
  if (!order) throw notFound('Order');
  return order;
}

/** Create an order with multi-package support + tracking number + QR. */
async function create(orgId, data, { createdBy } = {}) {
  if (!data.customerId) throw badRequest('customerId required');
  const seq = await ids.nextSeq('order', 'orderNumber', orgId);
  const tracking = ids.trackingNumber();
  const qr = await generateTrackingQr(tracking).catch(() => null);

  const packages = Array.isArray(data.packages) && data.packages.length
    ? data.packages
    : [{ type: data.packageType || 'PARCEL', weightKg: data.totalWeightKg || 1, quantity: 1 }];

  const totals = packages.reduce(
    (acc, p) => ({
      weight: acc.weight + Number(p.weightKg || 0) * (p.quantity || 1),
      volume: acc.volume + Number(p.volumeM3 || 0),
      value: acc.value + Number(p.declaredValue || 0) * (p.quantity || 1),
    }),
    { weight: 0, volume: 0, value: 0 }
  );

  const promisedAt =
    data.promisedAt ||
    (data.scheduledDeliveryAt
      ? new Date(new Date(data.scheduledDeliveryAt).getTime() + (data.slaHours || 24) * 3600 * 1000)
      : null);

  const order = await prisma.order.create({
    data: {
      organizationId,
      branchId: data.branchId || null,
      customerId: data.customerId,
      orderNumber: ids.orderNumber(seq),
      trackingNumber: tracking,
      type: data.type || 'STANDARD',
      priority: data.priority || 'NORMAL',
      status: data.status === 'DRAFT' ? 'DRAFT' : 'CONFIRMED',
      pickupAddressLine: data.pickupAddressLine,
      pickupCity: data.pickupCity,
      pickupLatitude: data.pickupLatitude,
      pickupLongitude: data.pickupLongitude,
      pickupContactName: data.pickupContactName,
      pickupContactPhone: data.pickupContactPhone,
      scheduledPickupAt: data.scheduledPickupAt ? new Date(data.scheduledPickupAt) : null,
      deliveryAddressLine: data.deliveryAddressLine,
      deliveryCity: data.deliveryCity,
      deliveryLatitude: data.deliveryLatitude,
      deliveryLongitude: data.deliveryLongitude,
      deliveryContactName: data.deliveryContactName,
      deliveryContactPhone: data.deliveryContactPhone,
      scheduledDeliveryAt: data.scheduledDeliveryAt ? new Date(data.scheduledDeliveryAt) : null,
      deliveryWindowStart: data.deliveryWindowStart,
      deliveryWindowEnd: data.deliveryWindowEnd,
      totalWeightKg: totals.weight,
      totalVolumeM3: totals.volume,
      totalDeclaredValue: totals.value,
      chargeAmount: data.chargeAmount,
      currency: data.currency || 'USD',
      isCOD: !!data.isCOD,
      codAmount: data.codAmount || 0,
      specialInstructions: data.specialInstructions,
      customerNotes: data.customerNotes,
      internalNotes: data.internalNotes,
      promisedAt,
      source: data.source || 'manual',
      createdBy: createdBy || null,
      labelQrUrl: qr?.url || null,
      packages: {
        create: packages.map((p) => ({
          barcode: p.barcode || ids.barcode(),
          type: p.type || 'PARCEL',
          description: p.description,
          weightKg: p.weightKg || 0,
          lengthCm: p.lengthCm,
          widthCm: p.widthCm,
          heightCm: p.heightCm,
          quantity: p.quantity || 1,
          declaredValue: p.declaredValue || 0,
          handlingFlags: p.handlingFlags,
        })),
      },
      events: { create: { status: data.status === 'DRAFT' ? 'DRAFT' : 'CONFIRMED', note: 'Order created' } },
      shipment: { create: { status: 'PENDING' } },
    },
    include: { packages: true, customer: true },
  });

  // Notify org ops team of the new order
  notificationService
    .broadcastToOrgRole(orgId, 'DISPATCHER', {
      type: 'NEW_ORDER',
      title: `New ${order.priority.toLowerCase()} order ${order.orderNumber}`,
      body: `${order.customer?.companyName || 'Customer'} → ${order.deliveryCity || order.deliveryAddressLine}`,
      payload: { orderId: order.id, trackingNumber: order.trackingNumber },
    })
    .catch(() => {});
  emitToOrg(orgId, 'order:created', { id: order.id, status: order.status, priority: order.priority });

  return order;
}

/** Transition order status with event log + notifications + SLA check. */
async function updateStatus(orgId, id, { status, actorId, payload = {}, note }) {
  const order = await ensure(orgId, id);
  if (order.status === status) return order;

  const data = { status };
  if (status === 'PICKED_UP') data.pickedUpAt = new Date();
  if (status === 'DELIVERED') {
    data.deliveredAt = new Date();
    data.isLate = data.deliveredAt && order.promisedAt ? data.deliveredAt > order.promisedAt : order.isLate;
  }
  if (status === 'FAILED') {
    data.failedAt = new Date();
    data.failedReason = payload.failedReason || 'OTHER';
    data.failedNote = payload.failedNote;
  }
  if (status === 'CANCELLED') {
    data.cancelledAt = new Date();
    data.cancellationReason = note;
  }

  const updated = await prisma.order.update({ where: { id }, data });
  await prisma.orderEvent.create({ data: { orderId: id, status, note, actorId, payload } });

  // Free the vehicle + driver when terminal
  if (['DELIVERED', 'FAILED', 'CANCELLED', 'RETURNED'].includes(status)) {
    if (order.assignedVehicleId) await prisma.vehicle.update({ where: { id: order.assignedVehicleId }, data: { status: 'AVAILABLE' } }).catch(() => {});
    if (order.assignedDriverId) await prisma.driver.update({ where: { id: order.assignedDriverId }, data: { status: 'AVAILABLE' } }).catch(() => {});
  }

  // Customer + org notifications on meaningful transitions
  const customerUser = order.customer?.userId
    ? await prisma.user.findUnique({ where: { id: order.customer.userId } })
    : null;
  if (['DELIVERED', 'FAILED'].includes(status) && customerUser) {
    await notificationService.notifyUser({
      userId: customerUser.id,
      organizationId: orgId,
      type: status === 'DELIVERED' ? 'DELIVERY_COMPLETED' : 'DELIVERY_FAILED',
      title: status === 'DELIVERED' ? 'Delivery completed' : 'Delivery failed',
      body: `Order ${order.orderNumber} ${status === 'DELIVERED' ? 'has been delivered' : `failed: ${data.failedReason}`}`,
      payload: { orderId: id, trackingNumber: order.trackingNumber },
    });
  }
  emitToOrg(orgId, 'order:updated', { id, status });
  if (order.trackingNumber) io()?.to(`track:${order.trackingNumber}`).emit('shipment:status', { status, at: new Date().toISOString() });

  return updated;
}

/** Record proof of delivery (signature + photos + COD). */
async function recordPod(orgId, id, { signatureUrl, photoUrls, capturedName, latitude, longitude, codCollected, metadata, scannedBarcodes }) {
  const order = await ensure(orgId, id);
  const pod = await prisma.proofOfDelivery.create({
    data: { orderId: id, signatureUrl, photoUrls, capturedName, latitude, longitude, codCollected, metadata },
  });
  if (order.isCOD && codCollected != null) {
    await prisma.order.update({ where: { id }, data: { codCollected } });
  }
  await updateStatus(orgId, id, { status: 'DELIVERED', payload: { scannedBarcodes, hasPod: true }, note: 'Delivered — proof captured' });
  return pod;
}

/** Reschedule a failed delivery → creates a fresh attempt. */
async function reschedule(orgId, id, { scheduledDeliveryAt, reason }) {
  const order = await ensure(orgId, id);
  if (order.status !== 'FAILED') throw badRequest('Only failed deliveries can be rescheduled');
  const seq = await ids.nextSeq('order', 'orderNumber', orgId);
  const clone = await prisma.order.create({
    data: {
      organizationId: orgId,
      branchId: order.branchId,
      customerId: order.customerId,
      orderNumber: ids.orderNumber(seq),
      trackingNumber: ids.trackingNumber(),
      type: order.type,
      priority: order.priority,
      status: 'CONFIRMED',
      pickupAddressLine: order.pickupAddressLine,
      pickupCity: order.pickupCity,
      deliveryAddressLine: order.deliveryAddressLine,
      deliveryCity: order.deliveryCity,
      deliveryLatitude: order.deliveryLatitude,
      deliveryLongitude: order.deliveryLongitude,
      totalWeightKg: order.totalWeightKg,
      chargeAmount: order.chargeAmount,
      scheduledDeliveryAt: scheduledDeliveryAt ? new Date(scheduledDeliveryAt) : null,
      rescheduledFromId: order.id,
      internalNotes: `Rescheduled from ${order.orderNumber}: ${reason || ''}`,
      events: { create: { status: 'CONFIRMED', note: `Rescheduled from ${order.orderNumber}` } },
    },
  });
  return clone;
}

/** Create a return order from a failed delivery. */
async function createReturn(orgId, id) {
  const order = await ensure(orgId, id);
  const seq = await ids.nextSeq('order', 'orderNumber', orgId);
  const ret = await prisma.order.create({
    data: {
      organizationId: orgId,
      customerId: order.customerId,
      orderNumber: ids.orderNumber(seq),
      trackingNumber: ids.trackingNumber(),
      type: 'RETURN',
      status: 'CONFIRMED',
      pickupAddressLine: order.deliveryAddressLine,
      pickupCity: order.deliveryCity,
      deliveryAddressLine: order.pickupAddressLine,
      deliveryCity: order.pickupCity,
      rescheduledFromId: order.id,
      events: { create: { status: 'CONFIRMED', note: `Return from ${order.orderNumber}` } },
    },
  });
  await prisma.order.update({ where: { id }, data: { returnOrderId: ret.id, status: 'RETURNED' } });
  return ret;
}

/** Duplicate an order (repeat orders). */
async function clone(orgId, id, { createdBy } = {}) {
  const order = await get(orgId, id);
  const seq = await ids.nextSeq('order', 'orderNumber', orgId);
  return prisma.order.create({
    data: {
      organizationId: orgId,
      branchId: order.branchId,
      customerId: order.customerId,
      orderNumber: ids.orderNumber(seq),
      trackingNumber: ids.trackingNumber(),
      type: order.type,
      priority: order.priority,
      status: 'DRAFT',
      pickupAddressLine: order.pickupAddressLine,
      pickupCity: order.pickupCity,
      deliveryAddressLine: order.deliveryAddressLine,
      deliveryCity: order.deliveryCity,
      deliveryLatitude: order.deliveryLatitude,
      deliveryLongitude: order.deliveryLongitude,
      totalWeightKg: order.totalWeightKg,
      chargeAmount: order.chargeAmount,
      createdBy: createdBy || null,
      events: { create: { status: 'DRAFT', note: `Cloned from ${order.orderNumber}` } },
    },
  });
}

/** Record COD cash reconciliation. */
async function reconcileCod(orgId, id, { collected }) {
  const order = await ensure(orgId, id);
  if (!order.isCOD) throw badRequest('Order is not COD');
  return prisma.order.update({ where: { id }, data: { codCollected: collected, codReconciledAt: new Date() } });
}

async function ensure(orgId, id) {
  const order = await prisma.order.findFirst({ where: { id, organizationId: orgId }, include: { customer: true } });
  if (!order) throw notFound('Order');
  return order;
}

function io() {
  try { return require('../socket').getIo(); } catch { return null; }
}

module.exports = { list, search, get, create, updateStatus, recordPod, reschedule, createReturn, clone, reconcileCod };
