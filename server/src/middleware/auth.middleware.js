const { getAuth } = require('@clerk/express');
const prisma = require('../lib/prisma');
const { unauthorized } = require('../utils/response.util');

/**
 * Requires a valid Clerk session and resolves/attaches the platform User row.
 * Populates req.auth = { userId (clerk), sessionId } and req.user (DB record).
 */
async function requireAuth(req, res, next) {
  try {
    const { userId } = getAuth(req);
    if (!userId) throw unauthorized('Not authenticated');

    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      include: { organization: true },
    });
    if (!user) {
      throw unauthorized('User not provisioned. Contact your administrator.');
    }
    if (user.status !== 'ACTIVE') {
      throw unauthorized(`Account is ${user.status.toLowerCase()}`);
    }

    req.user = user;
    req.userId = user.id;
    req.organizationId = user.organizationId;
    next();
  } catch (err) {
    next(err);
  }
}

/** Optional auth — attaches user when a session exists but never blocks. */
async function optionalAuth(req, _res, next) {
  try {
    const { userId } = require('@clerk/express').getAuth(req);
    if (userId) {
      const user = await prisma.user.findUnique({ where: { clerkId: userId } });
      if (user) {
        req.user = user;
        req.userId = user.id;
        req.organizationId = user.organizationId;
      }
    }
  } catch (_) {
    /* ignore — treated as anonymous */
  }
  next();
}

module.exports = { requireAuth, optionalAuth };
