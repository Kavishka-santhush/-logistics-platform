const prisma = require('../lib/prisma');
const { crud } = require('../lib/crud');
const { notFound, badRequest } = require('../utils/response.util');
const warehouseService = require('./warehouse.service');

const base = crud('inventoryItem');
const list = (orgId, opts) => base.list(orgId, opts);
const create = (orgId, data) => base.create(orgId, data);
const update = (orgId, id, data) => base.update(orgId, id, data);
const remove = (orgId, id) => base.remove(orgId, id);

async function get(orgId, id) {
  const i = await prisma.inventoryItem.findFirst({ where: { id, organizationId: orgId }, include: { warehouse: { select: { name: true } }, movements: { orderBy: { createdAt: 'desc' }, take: 30 } } });
  if (!i) throw notFound('Inventory item');
  return i;
}

/** Trigram search across SKU + name. */
async function search(orgId, { q, warehouseId, lowStock, page = 1, pageSize = 50 }) {
  const where = { organizationId: orgId };
  if (warehouseId) where.warehouseId = warehouseId;
  if (q) where.OR = [{ sku: { contains: q, mode: 'insensitive' } }, { name: { contains: q, mode: 'insensitive' } }, { barcode: q }];
  const [data, total] = await Promise.all([
    prisma.inventoryItem.findMany({ where, orderBy: { name: 'asc' }, skip: (page - 1) * pageSize, take: pageSize, include: { warehouse: { select: { name: true } } } }),
    prisma.inventoryItem.count({ where }),
  ]);
  const items = lowStock ? data.filter((d) => Number(d.quantity) <= Number(d.minStock)) : data;
  return { data: items, total, page, pageSize };
}

/** Barcode / QR scan lookup. */
async function scan(orgId, code) {
  return prisma.inventoryItem.findFirst({ where: { organizationId: orgId, OR: [{ barcode: code }, { sku: code }] }, include: { warehouse: true } });
}

/** Record a stock movement (IN/OUT/TRANSFER) and adjust the on-hand quantity. */
async function move(orgId, { itemId, type, quantity, fromBin, toBin, referenceType, referenceId, operatorName, note }) {
  const item = await get(orgId, itemId);
  const qty = Number(quantity);
  let delta = 0;
  if (['INBOUND', 'RETURN'].includes(type)) delta = qty;
  else if (['OUTBOUND', 'CROSS_DOCK'].includes(type)) delta = -qty;
  else if (type === 'ADJUSTMENT') delta = qty - Number(item.quantity);
  // TRANSFER handled separately
  if (type === 'OUTBOUND' && Number(item.quantity) < qty) throw badRequest('Insufficient stock');

  const movement = await prisma.stockMovement.create({ data: { organizationId: orgId, warehouseId: item.warehouseId, itemId, type, quantity: qty, fromBin, toBin, referenceType, referenceId, operatorName, note } });
  if (delta !== 0) await prisma.inventoryItem.update({ where: { id: itemId }, data: { quantity: { increment: delta } } });
  return movement;
}

/** Physical-count adjustment variance. */
async function adjust(orgId, { itemId, countedQty, reason, adjustedBy }) {
  const item = await get(orgId, itemId);
  const variance = Number(countedQty) - Number(item.quantity);
  const [adj] = await Promise.all([
    prisma.stockAdjustment.create({ data: { itemId, countedQty, systemQty: item.quantity, variance, reason, adjustedBy } }),
    prisma.inventoryItem.update({ where: { id: itemId }, data: { quantity: countedQty, lastCountedAt: new Date() } }),
  ]);
  return adj;
}

/** Transfer stock between two warehouses. */
async function transfer(orgId, { sku, fromWarehouseId, toWarehouseId, quantity }) {
  const from = await prisma.inventoryItem.findFirst({ where: { organizationId: orgId, warehouseId: fromWarehouseId, sku } });
  if (!from) throw notFound('Source item');
  const to = await prisma.inventoryItem.upsert({ where: { warehouseId_sku: { warehouseId: toWarehouseId, sku } }, update: { quantity: { increment: Number(quantity) } }, create: { organizationId: orgId, warehouseId: toWarehouseId, sku, name: from.name, quantity: Number(quantity) } });
  await Promise.all([
    prisma.inventoryItem.update({ where: { id: from.id }, data: { quantity: { decrement: Number(quantity) } } }),
    prisma.stockMovement.create({ data: { organizationId: orgId, warehouseId: fromWarehouseId, itemId: from.id, type: 'TRANSFER', quantity: Number(quantity), referenceType: 'transfer' } }),
    prisma.stockMovement.create({ data: { organizationId: orgId, warehouseId: toWarehouseId, itemId: to.id, type: 'TRANSFER', quantity: Number(quantity), referenceType: 'transfer' } }),
  ]);
  return to;
}

/** Items at or below min-stock threshold. */
async function lowStock(orgId) {
  const items = await prisma.inventoryItem.findMany({ where: { organizationId: orgId } });
  return items.filter((i) => Number(i.quantity) <= Number(i.minStock));
}

/** Create a warehouse pick/pack/putaway task. */
async function createTask(orgId, data) {
  await warehouseService.ensureWarehouse(orgId, data.warehouseId);
  return prisma.warehouseTask.create({ data: { warehouseId: data.warehouseId, itemId: data.itemId, type: data.type, assignedToName: data.assignedToName, referenceId: data.referenceId, priority: data.priority, dueAt: data.dueAt ? new Date(data.dueAt) : null } });
}

async function updateTask(orgId, id, data) {
  return prisma.warehouseTask.update({ where: { id }, data: { status: data.status, completedAt: data.status === 'done' ? new Date() : undefined } });
}

module.exports = { list, get, create, update, remove, search, scan, move, adjust, transfer, lowStock, createTask, updateTask };
