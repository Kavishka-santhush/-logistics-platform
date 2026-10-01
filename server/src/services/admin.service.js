const prisma = require('../lib/prisma');
const { notFound, badRequest, conflict } = require('../utils/response.util');
const { audit } = require('../lib/audit');

/**
 * Platform / SUPER_ADMIN service. These helpers intentionally cross
 * organization boundaries (unlike the org-scoped domain services) and are only
 * reachable behind the requireRole('SUPER_ADMIN') guard in the route layer.
 */

// ── Platform-wide stats ─────────────────────────────────────────────────────────
async function platformStats() {
  const [orgs, orgsActive, users, vehicles, drivers, orders, invoices, aiCost, now] = await Promise.all([
    prisma.organization.count(),
    prisma.organization.count({ where: { isActive: true } }),
    prisma.user.count(),
    prisma.vehicle.count(),
    prisma.driver.count(),
    prisma.order.count(),
    prisma.invoice.aggregate({ _sum: { totalAmount: true, balanceDue: true } }),
    prisma.aiUsageLog.aggregate({ _sum: { estimatedCostUsd: true } }),
    Promise.resolve(new Date()),
  ]);
  const newOrgs30d = await prisma.organization.count({ where: { subscriptionStatus: 'ACTIVE' } });
  const byTier = await prisma.organization.groupBy({ by: ['subscriptionTier'], _count: { _all: true } });
  const byStatus = await prisma.organization.groupBy({ by: ['subscriptionStatus'], _count: { _all: true } });
  return {
    organizations: { total: orgs, active: orgsActive, newRecent: newOrgs30d, byTier: Object.fromEntries(byTier.map((t) => [t.subscriptionTier, t._count._all])), byStatus: Object.fromEntries(byStatus.map((s) => [s.subscriptionStatus, s._count._all])) },
    users, vehicles, drivers, orders,
    billing: { billedTotal: Number(invoices._sum.totalAmount || 0), outstanding: Number(invoices._sum.balanceDue || 0) },
    aiSpendUsd: Number(aiCost._sum.estimatedCostUsd || 0),
    generatedAt: now.toISOString(),
  };
}

// ── Organizations ────────────────────────────────────────────────────────────────
async function listOrganizations({ search, tier, status, page = 1, pageSize = 25 } = {}) {
  const where = {
    ...(tier ? { subscriptionTier: tier } : {}),
    ...(status ? { subscriptionStatus: status } : {}),
    ...(search ? { OR: [{ name: { contains: search } }, { slug: { contains: search } }, { email: { contains: search } }] } : {}),
  };
  const [data, total] = await Promise.all([
    prisma.organization.findMany({ where, include: { _count: { select: { users: true, vehicles: true, drivers: true, orders: true, customers: true } } }, orderBy: { name: 'asc' }, skip: (page - 1) * pageSize, take: pageSize }),
    prisma.organization.count({ where }),
  ]);
  return { data, total, page, pageSize };
}

async function getOrganization(id) {
  const org = await prisma.organization.findUnique({ where: { id }, include: { branches: true, _count: { select: { users: true, vehicles: true, drivers: true, orders: true, customers: true, invoices: true } } } });
  if (!org) throw notFound('Organization');
  return org;
}

/** Provision a new tenant with its first ORG_ADMIN user. */
async function createOrganization(data, { actorId } = {}) {
  if (!data.name || !data.slug) throw badRequest('name and slug are required');
  const dup = await prisma.organization.findFirst({ where: { slug: data.slug } });
  if (dup) throw conflict('That slug is already taken');
  const org = await prisma.organization.create({
    data: {
      name: data.name,
      slug: data.slug,
      email: data.email,
      phone: data.phone,
      city: data.city,
      country: data.country,
      currency: data.currency || 'USD',
      timezone: data.timezone || 'UTC',
      subscriptionTier: data.subscriptionTier || 'STARTER',
      subscriptionStatus: data.subscriptionStatus || 'TRIALING',
      trialEndsAt: data.trialEndsAt ? new Date(data.trialEndsAt) : null,
      ...(data.admin ? { users: { create: { clerkId: data.admin.clerkId, email: data.admin.email, firstName: data.admin.firstName || null, lastName: data.admin.lastName || null, role: 'ORG_ADMIN', status: 'ACTIVE' } } } : {}),
    },
    include: { users: true },
  });
  await audit({ organizationId: org.id, userId: actorId, action: 'CREATE', entityType: 'Organization', entityId: org.id, after: { name: org.name, slug: org.slug } });
  return org;
}

async function updateOrganization(id, data) {
  await getOrganization(id);
  return prisma.organization.update({ where: { id }, data });
}

async function setOrganizationActive(id, isActive, { actorId } = {}) {
  await getOrganization(id);
  const org = await prisma.organization.update({ where: { id }, data: { isActive } });
  await audit({ organizationId: id, userId: actorId, action: 'UPDATE', entityType: 'Organization', entityId: id, after: { isActive } });
  return org;
}

/** Change a tenant's plan / subscription state (manual override or Stripe sync). */
async function setSubscription(id, { tier, status, stripeSubscriptionId, trialEndsAt }, { actorId } = {}) {
  await getOrganization(id);
  const data = {
    ...(tier ? { subscriptionTier: tier } : {}),
    ...(status ? { subscriptionStatus: status } : {}),
    ...(stripeSubscriptionId !== undefined ? { subscriptionId: stripeSubscriptionId } : {}),
    ...(trialEndsAt ? { trialEndsAt: new Date(trialEndsAt) } : {}),
  };
  const org = await prisma.organization.update({ where: { id }, data });
  await audit({ organizationId: id, userId: actorId, action: 'UPDATE', entityType: 'Subscription', entityId: id, after: data });
  return org;
}

// ── Plans ──────────────────────────────────────────────────────────────────────
const listPlans = () => prisma.subscriptionPlan.findMany({ orderBy: { priceMonthly: 'asc' } });
async function upsertPlan(data) {
  return prisma.subscriptionPlan.upsert({ where: { tier: data.tier }, update: data, create: data });
}

// ── Users (cross-org) ────────────────────────────────────────────────────────────
async function listUsers({ search, role, orgId, page = 1, pageSize = 25 } = {}) {
  const where = {
    ...(role ? { role } : {}),
    ...(orgId ? { organizationId: orgId } : {}),
    ...(search ? { OR: [{ email: { contains: search } }, { firstName: { contains: search } }, { lastName: { contains: search } }, { clerkId: { contains: search } }] } : {}),
  };
  const [data, total] = await Promise.all([
    prisma.user.findMany({ where, include: { organization: { select: { name: true, slug: true } } }, orderBy: { email: 'asc' }, skip: (page - 1) * pageSize, take: pageSize }),
    prisma.user.count({ where }),
  ]);
  return { data, total, page, pageSize };
}

async function setUserStatus(id, status) {
  const u = await prisma.user.update({ where: { id }, data: { status } });
  await audit({ userId: id, organizationId: u.organizationId, action: 'UPDATE', entityType: 'User', entityId: id, after: { status } });
  return u;
}

async function setUserRole(id, role, organizationId) {
  const u = await prisma.user.update({ where: { id }, data: { role, ...(organizationId ? { organizationId } : {}) } });
  await audit({ userId: id, organizationId: u.organizationId, action: 'UPDATE', entityType: 'User', entityId: id, after: { role } });
  return u;
}

// ── Audit log explorer ───────────────────────────────────────────────────────────
async function auditLogs({ orgId, userId, entityType, action, from, to, page = 1, pageSize = 50 } = {}) {
  const where = {
    ...(orgId ? { organizationId: orgId } : {}),
    ...(userId ? { userId } : {}),
    ...(entityType ? { entityType } : {}),
    ...(action ? { action } : {}),
    ...(from || to ? { createdAt: { ...(from && { gte: new Date(from) }), ...(to && { lte: new Date(to) }) } } : {}),
  };
  const [data, total] = await Promise.all([
    prisma.auditLog.findMany({ where, include: { user: { select: { email: true } }, organization: { select: { name: true } } }, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
    prisma.auditLog.count({ where }),
  ]);
  return { data, total, page, pageSize };
}

// ── Health / integrations probe ──────────────────────────────────────────────────
async function systemHealth() {
  const config = require('../config');
  const checks = {};
  try { await prisma.$queryRaw`SELECT 1`; checks.database = 'ok'; } catch (e) { checks.database = `error: ${e.message}`; }
  checks.stripe = config.stripe.secretKey ? 'configured' : 'missing';
  checks.openrouter = config.openrouter.apiKey ? 'configured' : 'missing';
  checks.googleMaps = config.googleMapsApiKey ? 'configured' : 'missing';
  checks.smtp = config.smtp.host ? 'configured' : 'missing';
  const recentAiFailures = await prisma.aiUsageLog.count({ where: { success: false, createdAt: { gte: new Date(Date.now() - 864e5) } } });
  checks.aiFailures24h = recentAiFailures;
  checks.uptimeSec = Math.round(process.uptime());
  return checks;
}

module.exports = { platformStats, listOrganizations, getOrganization, createOrganization, updateOrganization, setOrganizationActive, setSubscription, listPlans, upsertPlan, listUsers, setUserStatus, setUserRole, auditLogs, systemHealth };
