const prisma = require('./prisma');

/** Fire-and-forget audit trail writer. Never throws into the request path. */
async function audit({
  organizationId,
  userId,
  action, // CREATE | UPDATE | DELETE | LOGIN | ...
  entityType,
  entityId,
  before,
  after,
  ipAddress,
  userAgent,
}) {
  try {
    await prisma.auditLog.create({
      data: {
        organizationId: organizationId || null,
        userId: userId || null,
        action,
        entityType,
        entityId: entityId ? String(entityId) : null,
        before: before ?? undefined,
        after: after ?? undefined,
        ipAddress,
        userAgent,
      },
    });
  } catch (_) {
    /* auditing must not break business flows */
  }
}

module.exports = { audit };
