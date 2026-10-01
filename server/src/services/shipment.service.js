const prisma = require('../lib/prisma');
const { crud } = require('../lib/crud');
const { notFound } = require('../utils/response.util');

const base = crud('shipment', { scopeKey: null });

async function get(orderId) {
  const s = await prisma.shipment.findFirst({ where: { orderId }, include: { order: { select: { orderNumber: true, trackingNumber: true, status: true } } } });
  if (!s) throw notFound('Shipment');
  return s;
}

/** Update shipment status independently of the order lifecycle (hub-to-hub view). */
async function updateStatus(orderId, { status, etaAt, currentHubId }) {
  const existing = await prisma.shipment.findFirst({ where: { orderId } });
  const data = { status, etaAt: etaAt ? new Date(etaAt) : undefined, currentHubId, lastUpdatedAt: new Date() };
  if (existing) return prisma.shipment.update({ where: { id: existing.id }, data });
  return prisma.shipment.create({ data: { orderId, ...data } });
}

/** Timeline of key events for a shipment (derived from order events). */
async function timeline(orderId) {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { events: { orderBy: { createdAt: 'asc' } }, assignedVehicle: { select: { telematics: true } } } });
  if (!order) throw notFound('Order');
  return {
    trackingNumber: order.trackingNumber,
    status: order.status,
    events: order.events,
    position: order.assignedVehicle?.telematics?.lat != null
      ? { lat: Number(order.assignedVehicle.telematics.lat), lng: Number(order.assignedVehicle.telematics.lng) }
      : null,
  };
}

module.exports = { get, updateStatus, timeline };
