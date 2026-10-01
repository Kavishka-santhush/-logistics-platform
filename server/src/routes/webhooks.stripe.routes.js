const { Router, raw } = require('express');
const logger = require('../utils/logger.util');
const config = require('../config');
const stripeLib = require('../lib/stripe');
const prisma = require('../lib/prisma');
const invoiceSvc = require('../services/invoice.service');

const router = Router();

/**
 * Stripe webhook. Requires the RAW request body for signature verification, so
 * this router is mounted ahead of the global express.json() parser in app.js.
 */
router.post('/', raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripeLib.constructWebhookEvent(req.body, sig, config.stripe.webhookSecret);
  } catch (err) {
    logger.warn(`Stripe signature verification failed: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const invoiceNumber = session.metadata?.invoiceNumber;
        if (invoiceNumber) {
          await invoiceSvc.completeStripePayment({
            invoiceNumber,
            amountCents: session.amount_total,
            paymentIntentId: session.payment_intent,
          });
        }
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        const org = await prisma.organization.findFirst({ where: { subscriptionId: sub.id } });
        if (org) {
          const status = event.type === 'customer.subscription.deleted' ? 'CANCELLED'
            : sub.status === 'active' || sub.status === 'trialing' ? 'ACTIVE'
            : sub.status === 'past_due' ? 'PAST_DUE' : 'CANCELLED';
          await prisma.organization.update({
            where: { id: org.id },
            data: { subscriptionStatus: status, ...(event.type === 'customer.subscription.deleted' ? { subscriptionId: null } : {}) },
          });
        }
        break;
      }

      case 'invoice.payment_failed': {
        const stripeInvoice = event.data.object;
        const org = await prisma.organization.findFirst({ where: { subscriptionId: stripeInvoice.subscription } });
        if (org) await prisma.organization.update({ where: { id: org.id }, data: { subscriptionStatus: 'PAST_DUE' } });
        break;
      }

      default:
        break;
    }
    res.json({ received: true });
  } catch (err) {
    logger.error('Stripe webhook handler failed', err);
    res.status(500).json({ received: false });
  }
});

module.exports = router;
