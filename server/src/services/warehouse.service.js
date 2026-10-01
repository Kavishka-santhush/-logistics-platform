const prisma = require('../lib/prisma');
const { crud } = require('../lib/crud');
const { notFound } = require('../utils/response.util');
const ids = require('../utils/ids.util');

const base = crud('warehouse');
const list = (orgId, opts) => base.list(orgId, opts);
const create = (orgId, data) => base.create(orgId, data);
const update = (orgId, id, data) => base.update(orgId, id, data);
const remove = (orgId, id) => base.remove(orgId, id);

async function get(orgId, id) {
  const w = await prisma.warehouse.findFirst({
    where: { id, organizationId: orgId },
    include: { zones: true, _count: { select: { inventory: true, movements: true, tasks: true } } },
  });
  if (!w) throw notFound('Warehouse');
  return {
    ...w,
    capacityUtilizationPct: w.capacityM3 > 0 ? Number(((Number(w.usedM3) / Number(w.capacityM3)) * 100).toFixed(1)) : 0,
  };
}

async function addZone(orgId, warehouseId, data) {
  await ensureWarehouse(orgId, warehouseId);
  return prisma.warehouseZone.create({ data: { warehouseId, ...data } });
}

/** Inbound GRN — receive goods and upsert stock. */
async function receiveInbound(orgId, { warehouseId, supplierName, lines, grnNumber }) {
  await ensureWarehouse(orgId, warehouseId);
  const inbound = await prisma.inboundShipment.create({
    data: { warehouseId, grnNumber: grnNumber || ids.grnNumber(1), supplierName, status: 'received', receivedAt: new Date(), lines },
  });
  for (const line of lines || []) {
    const item = await prisma.inventoryItem.upsert({
      where: { warehouseId_sku: { warehouseId, sku: line.sku } },
      update: { quantity: { increment: Number(line.qty) } },
      create: { organizationId: orgId, warehouseId, sku: line.sku, name: line.name, quantity: Number(line.qty), unit: line.unit || 'pcs', unitValue: line.unitValue },
    });
    await prisma.stockMovement.create({ data: { organizationId: orgId, warehouseId, itemId: item.id, type: 'INBOUND', quantity: Number(line.qty), referenceType: 'grn', referenceId: inbound.id } });
  }
  return inbound;
}

/** Cross-dock: immediately create an outbound movement referencing an inbound. */
async function crossDock(orgId, { warehouseId, sku, qty, destinationOrderId }) {
  const item = await prisma.inventoryItem.findFirst({ where: { warehouseId, sku } });
  if (!item) throw notFound('Inventory item');
  return prisma.stockMovement.create({
    data: { organizationId: orgId, warehouseId, itemId: item.id, type: 'CROSS_DOCK', quantity: Number(qty), referenceType: 'order', referenceId: destinationOrderId },
  });
}

/** Warehouse performance metrics. */
async function performance(orgId, warehouseId) {
  await ensureWarehouse(orgId, warehouseId);
  const since = new Date(Date.now() - 30 * 864e5);
  const [inbound, outbound, tasks, tasksDone] = await Promise.all([
    prisma.stockMovement.count({ where: { warehouseId, type: 'INBOUND', createdAt: { gte: since } } }),
    prisma.stockMovement.count({ where: { warehouseId, type: { in: ['OUTBOUND', 'CROSS_DOCK'] }, createdAt: { gte: since } } }),
    prisma.warehouseTask.count({ where: { warehouseId } }),
    prisma.warehouseTask.count({ where: { warehouseId, status: 'done' } }),
  ]);
  return { inbound, outbound, throughput: inbound + outbound, taskCompletionPct: tasks ? Number(((tasksDone / tasks) * 100).toFixed(1)) : 0 };
}

async function ensureWarehouse(orgId, id) {
  const w = await prisma.warehouse.findFirst({ where: { id, organizationId: orgId } });
  if (!w) throw notFound('Warehouse');
  return w;
}

module.exports = { list, get, create, update, remove, addZone, receiveInbound, crossDock, performance, ensureWarehouse };
