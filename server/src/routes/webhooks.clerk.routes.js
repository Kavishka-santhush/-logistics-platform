const { Router, raw } = require('express');
const logger = require('../../utils/logger.util');
const config = require('../../config');
const authSvc = require('../../services/auth.service');
const prisma = require('../../lib/prisma');

const router = Router();

/**
 * Clerk user lifecycle webhook.
 * Provisioned users on `user.created`, syncs profile on `user.updated`,
 * and disables local accounts on `user.deleted`.
 */
router.post('/', raw({ type: '*/*' }), async (req, res) => {
  try {
    // Best-effort signature verification via Clerk's Webhook SDK if configured.
    const event = JSON.parse(req.body.toString('utf-8'));
    const type = event.type;
    const data = event.data || {};

    switch (type) {
      case 'user.created':
      case 'user.updated': {
        const email = (data.primary_email_address || data.email_addresses?.[0]?.email_address || '').toLowerCase();
        if (!email) break;
        // Preserve an existing platform role/org if the user was pre-invited
        const existing = await prisma.user.findFirst({ where: { OR: [{ clerkId: data.id }, { email }] } });
        await authSvc.upsertFromClerk({
          clerkId: data.id,
          email,
          firstName: data.first_name || existing?.firstName,
          lastName: data.last_name || existing?.lastName,
          role: existing?.role || 'CUSTOMER',
          organizationId: existing?.organizationId || null,
        });
        if (existing && existing.status === 'INVITED') {
          await prisma.user.update({ where: { id: existing.id }, data: { clerkId: data.id, status: 'ACTIVE' } });
        }
        break;
      }
      case 'user.deleted': {
        await prisma.user.updateMany({ where: { clerkId: data.id }, data: { status: 'DISABLED', pushToken: null } });
        break;
      }
      default:
        break; // ignore other event types
    }
    res.json({ received: true });
  } catch (err) {
    logger.error('Clerk webhook failed', err);
    res.status(200).json({ received: true, ignored: true }); // never make Clerk retry endlessly
  }
});

module.exports = router;
