const prisma = require('../lib/prisma');
const { sendEmail } = require('../lib/mailer');
const { sendPush } = require('../lib/push');
const logger = require('../utils/logger.util');

/** Lazily resolve the io instance (avoids a circular require with the socket layer). */
function io() {
  try {
    return require('../socket').getIo();
  } catch (_) {
    return null;
  }
}

/**
 * Notify a single user. Persists an in-app Notification row, then fans out to
 * email / Expo push / web-push according to the user's NotificationPreference
 * (defaults applied when no preference row exists).
 */
async function notifyUser({
  userId,
  organizationId,
  type,
  title,
  body,
  payload = {},
  email, // optional { subject, template } — falls back to title/body
  forcePush = false,
}) {
  const [user, pref] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { email: true, pushToken: true, webPushEndpoint: true } }),
    prisma.notificationPreference.findUnique({
      where: { userId_type: { userId, type } },
    }),
  ]);
  if (!user) return null;

  const channels = pref
    ? { inApp: pref.inApp, email: pref.email, push: pref.push, webPush: pref.webPush }
    : { inApp: true, email: false, push: true, webPush: false };

  const row = await prisma.notification.create({
    data: {
      userId,
      organizationId: organizationId || null,
      type,
      channel: 'IN_APP',
      title,
      body,
      payload,
    },
  });

  // In-app realtime
  if (channels.inApp) {
    io()?.to(`user:${userId}`).emit('notification:new', {
      id: row.id,
      type,
      title,
      body,
      payload,
      createdAt: row.createdAt,
    });
    io()?.to(`user:${userId}`).emit('notification:count', {
      unread: await unreadCount(userId),
    });
  }

  // Email
  if (channels.email && user.email) {
    sendEmail({
      to: user.email,
      subject: email?.subject || title,
      template: email?.template,
      html: email?.template ? undefined : `<p>${body}</p>`,
    }).catch((e) => logger.warn('notify email failed', e.message));
  }

  // Expo push (mobile)
  if ((channels.push || forcePush) && user.pushToken) {
    sendPush(user.pushToken, { title, body, data: { type, ...payload } }).catch((e) =>
      logger.warn('notify push failed', e.message)
    );
  }

  return row;
}

/** Broadcast a notification to every user in an org that has the given role. */
async function broadcastToOrgRole(organizationId, role, { type, title, body, payload = {} }) {
  const users = await prisma.user.findMany({
    where: { organizationId, role, status: 'ACTIVE' },
    select: { id: true },
  });
  return Promise.all(
    users.map((u) => notifyUser({ userId: u.id, organizationId, type, title, body, payload }))
  );
}

async function list(userId, { page = 1, pageSize = 30, unreadOnly = false } = {}) {
  const where = { userId, ...(unreadOnly ? { isRead: false } : {}) };
  const [data, total] = await Promise.all([
    prisma.notification.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
    prisma.notification.count({ where }),
  ]);
  return { data, total, page, pageSize };
}

async function markRead({ id, userId }) {
  return prisma.notification.updateMany({
    where: { id, userId, isRead: false },
    data: { isRead: true, readAt: new Date() },
  });
}

async function markAllRead(userId) {
  return prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true, readAt: new Date() },
  });
}

async function unreadCount(userId) {
  return prisma.notification.count({ where: { userId, isRead: false } });
}

async function getPreferences(userId) {
  return prisma.notificationPreference.findMany({ where: { userId } });
}

async function setPreference({ userId, type, inApp, email, push, webPush }) {
  return prisma.notificationPreference.upsert({
    where: { userId_type: { userId, type } },
    update: { inApp, email, push, webPush },
    create: { userId, type, inApp: inApp ?? true, email: email ?? false, push: push ?? true, webPush: webPush ?? false },
  });
}

/** Direct invoice email to a customer (no Notification row — external recipient). */
async function invoiceEmail({ organizationId, to, invoice }) {
  const link = invoice.pdfUrl ? `${require('../config').publicBaseUrl}${invoice.pdfUrl}` : null;
  return sendEmail({
    to,
    subject: `Invoice ${invoice.number}`,
    html: `<p>Dear ${invoice.customer?.companyName || 'customer'},</p>
      <p>Invoice <strong>${invoice.number}</strong> for
      ${invoice.currency} ${Number(invoice.totalAmount).toFixed(2)} is available.
      Due ${new Date(invoice.dueDate).toLocaleDateString()}.</p>
      ${link ? `<p><a href="${link}">View / download invoice</a></p>` : ''}
      <p>Thank you.</p>`,
  });
}

module.exports = {
  notifyUser,
  broadcastToOrgRole,
  invoiceEmail,
  list,
  markRead,
  markAllRead,
  unreadCount,
  getPreferences,
  setPreference,
};
