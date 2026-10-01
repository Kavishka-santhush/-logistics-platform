const prisma = require('../lib/prisma');
const { getAuth, clerkClient } = require('@clerk/express');
const { notFound, badRequest } = require('../utils/response.util');

/**
 * Provision / sync a platform User from a Clerk identity. Called on first
 * authenticated request and by the Clerk `user.created` webhook.
 */
async function upsertFromClerk({ clerkId, email, firstName, lastName, role = 'CUSTOMER', organizationId = null }) {
  const existing = await prisma.user.findUnique({ where: { clerkId } });
  if (existing) {
    return prisma.user.update({
      where: { id: existing.id },
      data: { email, firstName, lastName, lastLoginAt: new Date(), ...(organizationId && !existing.organizationId ? { organizationId } : {}) },
    });
  }
  return prisma.user.create({
    data: { clerkId, email, firstName, lastName, role, organizationId, lastLoginAt: new Date() },
  });
}

/** Attach the current user to an organization by invite slug/code. */
async function joinOrganization({ userId, organizationSlug }) {
  const org = await prisma.organization.findUnique({ where: { slug: organizationSlug } });
  if (!org) throw notFound('Organization');
  return prisma.user.update({ where: { id: userId }, data: { organizationId: org.id } });
}

/** Current user profile (with org + driver/customer linkage) for app bootstrap. */
async function me(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      organization: true,
      driverProfile: { select: { id: true, name: true, employeeId: true, status: true } },
    },
  });
  if (!user) throw notFound('User');
  const { passwordPin, webPushEndpoint, ...safe } = user;
  return safe;
}

async function updateProfile({ userId, firstName, lastName, phone, avatarUrl, language, timezone }) {
  return prisma.user.update({
    where: { id: userId },
    data: { firstName, lastName, phone, avatarUrl, language, timezone },
  });
}

/** Register/deregister a device push token for the mobile driver app. */
async function setPushToken({ userId, token }) {
  return prisma.user.update({ where: { id: userId }, data: { pushToken: token } });
}

async function listOrgUsers(organizationId, { role, page = 1, pageSize = 50 } = {}) {
  const where = { organizationId, ...(role && { role }) };
  const [data, total] = await Promise.all([
    prisma.user.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
    prisma.user.count({ where }),
  ]);
  return { data, total, page, pageSize };
}

/** Invite a staff member — creates an INVITED row keyed on a placeholder clerkId. */
async function inviteUser({ organizationId, email, role, firstName, lastName }) {
  if (!['ORG_ADMIN', 'OPS_MANAGER', 'DISPATCHER', 'WAREHOUSE_MANAGER', 'COMPLIANCE_OFFICER', 'FINANCE_MANAGER', 'DRIVER'].includes(role)) {
    throw badRequest('Invalid staff role');
  }
  const placeholderClerkId = `inv_${email}`;
  return prisma.user.upsert({
    where: { email },
    update: { status: 'INVITED', role, organizationId },
    create: { clerkId: placeholderClerkId, email, role, firstName, lastName, status: 'INVITED', organizationId },
  });
}

module.exports = { upsertFromClerk, joinOrganization, me, updateProfile, setPushToken, listOrgUsers, inviteUser, clerkClient };
