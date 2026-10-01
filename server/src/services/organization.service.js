const prisma = require('../lib/prisma');
const { crud } = require('../lib/crud');
const { notFound, conflict } = require('../utils/response.util');
const ids = require('../utils/ids.util');

const base = crud('organization', { scopeKey: null });

/** Create an organization (super-admin action) + default branch + settings. */
async function create(data) {
  const slug = (data.slug || data.name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const exists = await prisma.organization.findUnique({ where: { slug } });
  if (exists) throw conflict('Organization slug already in use');
  return prisma.organization.create({
    data: {
      name: data.name,
      slug,
      email: data.email,
      phone: data.phone,
      taxNumber: data.taxNumber,
      addressLine: data.addressLine,
      city: data.city,
      country: data.country,
      currency: data.currency || 'USD',
      timezone: data.timezone || 'UTC',
      subscriptionTier: data.subscriptionTier || 'STARTER',
      branches: data.branchName
        ? { create: { name: data.branchName, code: 'HQ', city: data.city, country: data.country } }
        : undefined,
    },
    include: { branches: true },
  });
}

async function get(orgId) {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    include: { branches: true, _count: { select: { vehicles: true, drivers: true, orders: true, customers: true } } },
  });
  if (!org) throw notFound('Organization');
  return org;
}

async function update(orgId, data) {
  return prisma.organization.update({ where: { id: orgId }, data });
}

async function listAll({ page = 1, pageSize = 25 } = {}) {
  const [data, total] = await Promise.all([
    prisma.organization.findMany({ skip: (page - 1) * pageSize, take: pageSize, orderBy: { name: 'asc' } }),
    prisma.organization.count(),
  ]);
  return { data, total, page, pageSize };
}

// ── Branches ──────────────────────────────────────────────────────────────────
const branchCrud = crud('branch');
const listBranches = (orgId, opts) => branchCrud.list(orgId, opts);
const createBranch = (orgId, data) => branchCrud.create(orgId, data);
const updateBranch = (orgId, id, data) => branchCrud.update(orgId, id, data);
const removeBranch = (orgId, id) => branchCrud.remove(orgId, id);

// ── Subscription helpers ──────────────────────────────────────────────────────
async function setSubscription(orgId, { tier, subscriptionId, status }) {
  return prisma.organization.update({
    where: { id: orgId },
    data: { subscriptionTier: tier, subscriptionId, subscriptionStatus: status || 'ACTIVE' },
  });
}

async function getPlan(tier) {
  return prisma.subscriptionPlan.findUnique({ where: { tier } });
}

async function listPlans() {
  return prisma.subscriptionPlan.findMany({ where: { isActive: true }, orderBy: { priceMonthly: 'asc' } });
}

module.exports = { create, get, update, listAll, listBranches, createBranch, updateBranch, removeBranch, setSubscription, getPlan, listPlans };
