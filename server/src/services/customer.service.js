const prisma = require('../lib/prisma');
const { crud } = require('../lib/crud');
const { notFound, conflict } = require('../utils/response.util');
const googlemaps = require('../lib/googlemaps');

const base = crud('customer');
const list = (orgId, opts) => base.list(orgId, { include: { _count: { select: { orders: true, addresses: true, invoices: true } } }, ...opts });
const get = (orgId, id) =>
  prisma.customer
    .findFirst({ where: { id, organizationId: orgId }, include: { addresses: true, contracts: { where: { isActive: true } }, _count: { select: { orders: true } } } })
    .then((r) => r || Promise.reject(notFound('Customer')));

/** Trigram / prefix search across companyName, contactName, email. */
async function search(orgId, q) {
  if (!q) return [];
  return prisma.customer.findMany({
    where: { organizationId: orgId, OR: [{ companyName: { contains: q } }, { contactName: { contains: q } }, { email: { contains: q } }] },
    take: 25,
    orderBy: { companyName: 'asc' },
  });
}

async function create(orgId, data) {
  if (data.userId) {
    const dup = await prisma.customer.findFirst({ where: { userId: data.userId } });
    if (dup) throw conflict('A customer portal already exists for that user');
  }
  return prisma.customer.create({ data: { ...data, organizationId: orgId } });
}

const update = (orgId, id, data) =>
  get(orgId, id).then(() => prisma.customer.update({ where: { id }, data }));

/** Soft-archive a customer (never hard-delete; orders reference it with Restrict). */
async function archive(orgId, id) {
  await get(orgId, id);
  return prisma.customer.update({ where: { id }, data: { isArchived: true } });
}

// ── Addresses ─────────────────────────────────────────────────────────────────
async function addAddress(orgId, customerId, data) {
  await get(orgId, customerId);
  // geocode when no coords supplied
  let { latitude, longitude } = data;
  if ((latitude == null || longitude == null) && data.addressLine) {
    const g = await googlemaps.geocode(`${data.addressLine} ${data.city || ''}`.trim()).catch(() => null);
    if (g) { latitude = g.lat; longitude = g.lng; }
  }
  if (data.isDefault) await prisma.customerAddress.updateMany({ where: { customerId }, data: { isDefault: false } });
  return prisma.customerAddress.create({
    data: { customerId, label: data.label, addressLine: data.addressLine, city: data.city, latitude, longitude, contactName: data.contactName, contactPhone: data.contactPhone, isDefault: data.isDefault ?? false },
  });
}
const listAddresses = (orgId, customerId) => prisma.customerAddress.findMany({ where: { customerId }, orderBy: [{ isDefault: 'desc' }, { label: 'asc' }] });
const removeAddress = (orgId, customerId, addressId) => prisma.customerAddress.deleteMany({ where: { id: addressId, customerId } });

// ── Contracts ──────────────────────────────────────────────────────────────────
async function addContract(orgId, customerId, data) {
  await get(orgId, customerId);
  return prisma.customerContract.create({
    data: { customerId, name: data.name, startDate: new Date(data.startDate), endDate: data.endDate ? new Date(data.endDate) : null, rateOverride: data.rateOverride, fileUrl: data.fileUrl },
  });
}
const listContracts = (orgId, customerId) => prisma.customerContract.findMany({ where: { customerId, customer: { organizationId: orgId } }, orderBy: { startDate: 'desc' } });

// ── Performance / SLA ──────────────────────────────────────────────────────────
/** On-time %, avg rating, open spend, order volume over window. */
async function performance(orgId, customerId, { days = 90 } = {}) {
  await get(orgId, customerId);
  const since = new Date(Date.now() - days * 864e5);
  const [total, delivered, onTime, revenue, breaches] = await Promise.all([
    prisma.order.count({ where: { customerId, createdAt: { gte: since } } }),
    prisma.order.count({ where: { customerId, status: 'DELIVERED', createdAt: { gte: since } } }),
    prisma.order.count({ where: { customerId, status: 'DELIVERED', isLate: false, createdAt: { gte: since } } }),
    prisma.order.aggregate({ where: { customerId, status: { in: ['DELIVERED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY'] }, createdAt: { gte: since } }, _sum: { chargeAmount: true } }),
    prisma.slaBreach.count({ where: { customerId, breachedAt: { gte: since } } }),
  ]);
  return {
    windowDays: days,
    ordersTotal: total,
    delivered,
    onTimeRate: delivered ? Number(((onTime / delivered) * 100).toFixed(1)) : null,
    revenue: Number(revenue._sum.chargeAmount || 0),
    slaBreaches: breaches,
  };
}

/** Record an SLA breach (called by order/tracking flows when a delivery misses promisedAt). */
async function recordBreach(orgId, { customerId, orderId, orderNo, minutesLate }) {
  return prisma.slaBreach.create({ data: { customerId, orderId, orderNo, minutesLate } });
}

/** Rolling 3-month order trend for churn signals. */
async function orderTrend(orgId, customerId, months = 6) {
  await get(orgId, customerId);
  const out = [];
  const now = new Date();
  for (let i = months - 1; i >= 0; i--) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    const [count, revenue] = await Promise.all([
      prisma.order.count({ where: { customerId, createdAt: { gte: start, lt: end } } }),
      prisma.order.aggregate({ where: { customerId, createdAt: { gte: start, lt: end } }, _sum: { chargeAmount: true } }),
    ]);
    out.push({ month: start.toISOString().slice(0, 7), orders: count, revenue: Number(revenue._sum.chargeAmount || 0) });
  }
  return out;
}

/** Portfolio-wide customer KPIs for the CRM dashboard. */
async function stats(orgId) {
  const [total, active, byTier] = await Promise.all([
    prisma.customer.count({ where: { organizationId: orgId, isArchived: false } }),
    prisma.customer.count({ where: { organizationId: orgId, isArchived: false, orders: { some: { createdAt: { gte: new Date(Date.now() - 30 * 864e5) } } } } }),
    prisma.customer.groupBy({ by: ['tier'], where: { organizationId: orgId, isArchived: false }, _count: { _all: true } }),
  ]);
  return { total, activeLast30d: active, tiers: Object.fromEntries(byTier.map((t) => [t.tier, t._count._all])) };
}

module.exports = { list, get, search, create, update, archive, addAddress, listAddresses, removeAddress, addContract, listContracts, performance, recordBreach, orderTrend, stats };
