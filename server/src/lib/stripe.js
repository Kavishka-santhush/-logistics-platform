const config = require('../config');
const logger = require('../utils/logger.util');

let stripe = null;

/** Lazily-instantiated Stripe client (null when key not configured). */
function getStripe() {
  if (!config.stripe.secretKey) return null;
  if (!stripe) {
    const Stripe = require('stripe');
    stripe = new Stripe(config.stripe.secretKey, { apiVersion: '2024-06-20' });
  }
  return stripe;
}

/** Create a hosted checkout / payment-link URL for an invoice amount. */
async function createInvoicePaymentLink({ amountCents, currency = 'usd', customerId, invoiceNumber, successUrl }) {
  const s = getStripe();
  if (!s) {
    logger.warn('Stripe not configured — returning placeholder payment url');
    return { url: null, id: null };
  }
  const link = await s.checkout.sessions.create({
    mode: 'payment',
    customer_email: customerId || undefined,
    line_items: [
      {
        price_data: {
          currency,
          product_data: { name: `Invoice ${invoiceNumber}` },
          unit_amount: amountCents,
        },
        quantity: 1,
      },
    ],
    success_url: successUrl || config.clientUrl,
    metadata: { invoiceNumber },
  });
  return { url: link.url, id: link.id };
}

/** Create or fetch a Stripe customer for an organization subscription. */
async function createSubscription({ stripeCustomerId, priceId }) {
  const s = getStripe();
  if (!s) return null;
  return s.subscriptions.create({ customer: stripeCustomerId, items: [{ price: priceId }] });
}

async function cancelSubscription(stripeSubscriptionId) {
  const s = getStripe();
  if (!s) return null;
  return s.subscriptions.cancel(stripeSubscriptionId);
}

function constructWebhookEvent(rawBody, signature) {
  const s = getStripe();
  return s.webhooks.constructEvent(rawBody, signature, config.stripe.webhookSecret);
}

module.exports = { getStripe, createInvoicePaymentLink, createSubscription, cancelSubscription, constructWebhookEvent };
