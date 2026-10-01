const prisma = require('../lib/prisma');
const { crud } = require('../lib/crud');
const { notFound, badRequest } = require('../utils/response.util');
const ids = require('../utils/ids.util');
const stripeLib = require('../lib/stripe');
const pdfLib = require('../lib/pdf');
const config = require('../config');
const notificationService = require('./notification.service');

const base = crud('invoice');
const list = (orgId, opts) => base.list(orgId, { include: { customer: { select: { companyName: true } } }, ...opts });
const get = (orgId, id) =>
  prisma.invoice
    .findFirst({ where: { id, organizationId: orgId }, include: { lines: { include: { order: { select: { orderNumber: true, trackingNumber: true } } } }, payments: true, creditNotes: true, customer: true } })
    .then((r) => r || Promise.reject(notFound('Invoice')));

// ── Pricing engine ─────────────────────────────────────────────────────────────
/**
 * Resolve the best-matching active pricing rule for an order and compute a
 * line breakdown. Precedence: customerId override → orderType → vehicleType →
 * zone → generic, then lowest `priority` number wins.
 */
async function priceOrder(orgId, order) {
  const rules = await prisma.pricingRule.findMany({ where: { organizationId: orgId, isActive: true }, orderBy: { priority: 'asc' } });
  const match = rules.find((r) => (r.customerId ? r.customerId === order.customerId : true)) || null;
  const scoped = rules.filter((r) =>
    (!r.customerId || r.customerId === order.customerId) &&
    (!r.orderType || r.orderType === order.type) &&
    (!r.zoneName || r.zoneName === (order.deliveryCity || null))
  );
  const rule = (scoped.find((r) => r.customerId === order.customerId) || scoped[0] || match || null);

  const distance = Number(order.distanceKm || 0);
  const weight = Number(order.totalWeightKg || 0);
  const lines = [];
  let subtotal = 0;

  if (!rule) {
    // Fall back to the manually-entered charge (if any)
    if (order.chargeAmount) {
      subtotal = Number(order.chargeAmount);
      lines.push({ type: 'DELIVERY_FEE', description: `Delivery ${order.orderNumber}`, quantity: 1, unitPrice: subtotal, amount: subtotal });
    }
    return { rule: null, currency: order.currency || 'USD', lines, subtotal, taxAmount: 0, total: subtotal };
  }

  const cur = rule.currency || order.currency || 'USD';
  const push = (line) => { lines.push(line); subtotal += Number(line.amount); };

  if (rule.model === 'FLAT') {
    const amt = Number(rule.flatRate || 0);
    push({ type: 'DELIVERY_FEE', description: `${rule.name} — ${order.orderNumber}`, quantity: 1, unitPrice: amt, amount: amt });
  } else if (rule.model === 'PER_KM') {
    const amt = Number(((rule.ratePerKm || 0) * distance).toFixed(2));
    push({ type: 'DISTANCE_CHARGE', description: `${distance} km @ ${rule.ratePerKm}/km`, quantity: distance || 1, unitPrice: Number(rule.ratePerKm), amount: amt });
  } else if (rule.model === 'PER_KG') {
    const amt = Number(((rule.ratePerKg || 0) * weight).toFixed(2));
    push({ type: 'WEIGHT_CHARGE', description: `${weight} kg @ ${rule.ratePerKg}/kg`, quantity: weight || 1, unitPrice: Number(rule.ratePerKg), amount: amt });
  } else {
    // ZONE_BASED / VEHICLE_TYPE → flat base + distance component if configured
    const base0 = Number(rule.flatRate || 0);
    const dist = rule.ratePerKm ? Number(((rule.ratePerKm || 0) * distance).toFixed(2)) : 0;
    if (base0) push({ type: 'DELIVERY_FEE', description: `${rule.name} base`, quantity: 1, unitPrice: base0, amount: base0 });
    if (dist) push({ type: 'DISTANCE_CHARGE', description: `${distance} km`, quantity: distance, unitPrice: Number(rule.ratePerKm), amount: dist });
  }

  // min-charge floor
  if (rule.minCharge && subtotal < Number(rule.minCharge)) {
    const diff = Number(rule.minCharge) - subtotal;
    push({ type: 'CUSTOM', description: 'Minimum charge adjustment', quantity: 1, unitPrice: diff, amount: diff });
    subtotal = Number(rule.minCharge);
  }

  // fuel surcharge %
  if (rule.fuelSurchargePct) {
    const sur = Number((subtotal * (Number(rule.fuelSurchargePct) / 100)).toFixed(2));
    if (sur) push({ type: 'FUEL_SURCHARGE', description: `Fuel surcharge ${rule.fuelSurchargePct}%`, quantity: 1, unitPrice: sur, amount: sur });
    subtotal += sur;
  }

  subtotal = Number(subtotal.toFixed(2));
  return { rule, currency: cur, lines, subtotal, taxAmount: 0, total: subtotal };
}

// ── Invoice assembly ─────────────────────────────────────────────────────────
const TERMS_DAYS = { dueOnReceipt: 0, net15: 15, net30: 30, net60: 60, prepaid: 0 };

/** Build a DRAFT invoice from one or more delivered/unbilled orders. */
async function generate(orgId, { customerId, orderIds, taxPct = 0, notes, includeUnpricedOrders = true }) {
  const customer = await prisma.customer.findFirst({ where: { id: customerId, organizationId: orgId } });
  if (!customer) throw notFound('Customer');

  const orders = await prisma.order.findMany({
    where: {
      organizationId: orgId,
      customerId,
      status: { in: ['DELIVERED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY'] },
      ...(orderIds?.length ? { id: { in: orderIds } } : {}),
      invoiceLines: { none: {} }, // not already billed
    },
    include: { assignedVehicle: { select: { type: true } } },
  });
  if (!orders.length && !includeUnpricedOrders) throw badRequest('No billable orders found');

  const allLines = [];
  for (const o of orders) {
    const priced = await priceOrder(orgId, { ...o, vehicleType: o.assignedVehicle?.type });
    for (const l of priced.lines) allLines.push({ ...l, orderId: o.id });
  }

  const subtotal = Number(allLines.reduce((s, l) => s + Number(l.amount), 0).toFixed(2));
  const taxAmount = Number((subtotal * (taxPct / 100)).toFixed(2));
  const total = Number((subtotal + taxAmount).toFixed(2));

  const termsDays = TERMS_DAYS[customer.paymentTerms || 'net30'] ?? 30;
  const dueDate = new Date(Date.now() + termsDays * 864e5);
  const seq = await ids.nextSeq('invoice', 'number', orgId);

  return prisma.invoice.create({
    data: {
      organizationId: orgId,
      customerId,
      number: ids.invoiceNumber(seq),
      status: 'DRAFT',
      dueDate,
      currency: orders[0]?.currency || customer?.orders?.[0]?.currency || 'USD',
      subtotal,
      taxAmount,
      totalAmount: total,
      balanceDue: total,
      notes,
      lines: { create: allLines.map((l) => ({ ...l, amount: Number(l.amount), unitPrice: Number(l.unitPrice), quantity: Number(l.quantity || 1), orderId: l.orderId || undefined })) },
    },
    include: { lines: true },
  });
}

/** Bulk-generate invoices for every customer with unbilled orders. */
async function generateAll(orgId) {
  const customers = await prisma.order.groupBy({ by: ['customerId'], where: { organizationId: orgId, status: 'DELIVERED', invoiceLines: { none: {} } } });
  const created = [];
  for (const c of customers) {
    try { created.push(await generate(orgId, { customerId: c.customerId })); } catch (_) { /* skip */ }
  }
  return created;
}

const update = (orgId, id, data) => get(orgId, id).then(() => recompute(orgId, prisma.invoice.update({ where: { id }, data: sanitize(data) })));
function sanitize(d) { const { lines, payments, customer, ...rest } = d; return rest; }

async function addLine(orgId, id, line) {
  await get(orgId, id);
  await prisma.invoiceLine.create({ data: { invoiceId: id, type: line.type || 'CUSTOM', description: line.description, quantity: Number(line.quantity || 1), unitPrice: Number(line.unitPrice), amount: Number(line.amount ?? Number(line.unitPrice) * Number(line.quantity || 1)), orderId: line.orderId || undefined } });
  return recompute(orgId, id);
}
async function removeLine(orgId, id, lineId) {
  await prisma.invoiceLine.deleteMany({ where: { id: lineId, invoiceId: id } });
  return recompute(orgId, id);
}

/** Recompute subtotal/tax/total/balance from lines + payments. */
async function recompute(orgId, idOrInvoice) {
  const id = typeof idOrInvoice === 'string' ? idOrInvoice : idOrInvoice.id;
  const inv = await prisma.invoice.findFirst({ where: { id, organizationId: orgId }, include: { lines: true, payments: { where: { status: 'COMPLETED' } }, creditNotes: true } });
  if (!inv) throw notFound('Invoice');
  const subtotal = Number(inv.lines.reduce((s, l) => s + Number(l.amount), 0).toFixed(2));
  const taxAmount = Number(inv.taxAmount || 0);
  const total = Number((subtotal + taxAmount).toFixed(2));
  const paid = Number(inv.payments.reduce((s, p) => s + Number(p.amount), 0).toFixed(2));
  const credited = Number(inv.creditNotes.reduce((s, c) => s + Number(c.amount), 0).toFixed(2));
  const balanceDue = Math.max(0, Number((total - paid - credited).toFixed(2)));
  let status = inv.status;
  if (inv.status !== 'CANCELLED' && inv.status !== 'DRAFT') {
    if (balanceDue <= 0) status = 'PAID';
    else if (paid + credited > 0) status = 'PARTIALLY_PAID';
    else if (new Date(inv.dueDate) < new Date()) status = 'OVERDUE';
    else status = 'SENT';
  }
  return prisma.invoice.update({ where: { id }, data: { subtotal, totalAmount: total, balanceDue, status }, include: { lines: true, payments: true } });
}

async function send(orgId, id, { recipientEmail } = {}) {
  const inv = await get(orgId, id);
  if (inv.status === 'DRAFT') await prisma.invoice.update({ where: { id }, data: { status: 'SENT' } });
  await renderPdf(orgId, id).catch(() => {});
  const to = recipientEmail || inv.customer.email;
  if (to) await notificationService.invoiceEmail({ organizationId: orgId, to, invoice: inv }).catch(() => {});
  return get(orgId, id);
}

async function cancel(orgId, id) {
  await get(orgId, id);
  return prisma.invoice.update({ where: { id }, data: { status: 'CANCELLED', balanceDue: 0 } });
}

// ── Payments ─────────────────────────────────────────────────────────────────
/** Record an off-line payment (cash / bank / cheque). */
async function recordPayment(orgId, id, { amount, method = 'CASH', reference, recordedBy }) {
  const inv = await get(orgId, id);
  if (Number(amount) <= 0) throw badRequest('Amount must be positive');
  if (Number(amount) > Number(inv.balanceDue)) throw badRequest('Payment exceeds balance due');
  await prisma.payment.create({ data: { organizationId: orgId, invoiceId: id, amount: Number(amount), currency: inv.currency, method, reference, recordedBy, status: 'COMPLETED' } });
  return recompute(orgId, id);
}

/** Create a Stripe Checkout link and store it on the invoice. */
async function createPaymentLink(orgId, id) {
  const inv = await get(orgId, id);
  const { url, id: sessionId } = await stripeLib.createInvoicePaymentLink({
    amountCents: Math.round(Number(inv.balanceDue) * 100),
    currency: (inv.currency || 'USD').toLowerCase(),
    invoiceNumber: inv.number,
    successUrl: `${config.clientUrl}/billing/invoices/${inv.id}?paid=1`,
  });
  if (!url) return { invoice: inv, paymentUrl: null, note: 'Stripe not configured' };
  await prisma.payment.create({ data: { organizationId: orgId, invoiceId: id, amount: Number(inv.balanceDue), currency: inv.currency, method: 'ONLINE', status: 'PENDING', reference: sessionId } });
  const updated = await prisma.invoice.update({ where: { id }, data: { stripePaymentLinkUrl: url } });
  return { invoice: updated, paymentUrl: url, sessionId };
}

/** Mark the pending online payment complete (called by Stripe webhook). */
async function completeStripePayment({ invoiceNumber, amountCents, paymentIntentId }) {
  const inv = await prisma.invoice.findFirst({ where: { number: invoiceNumber } });
  if (!inv) return null;
  const pending = await prisma.payment.findFirst({ where: { invoiceId: inv.id, method: 'ONLINE', status: 'PENDING' } });
  const amount = amountCents != null ? Number((amountCents / 100).toFixed(2)) : Number(inv.balanceDue);
  if (pending) {
    await prisma.payment.update({ where: { id: pending.id }, data: { status: 'COMPLETED', amount, stripePaymentIntentId: paymentIntentId, paidAt: new Date() } });
  } else {
    await prisma.payment.create({ data: { organizationId: inv.organizationId, invoiceId: inv.id, amount, currency: inv.currency, method: 'ONLINE', status: 'COMPLETED', stripePaymentIntentId: paymentIntentId } });
  }
  return recompute(inv.organizationId, inv.id);
}

async function refundPayment(orgId, paymentId) {
  const p = await prisma.payment.findFirst({ where: { id: paymentId, organizationId: orgId } });
  if (!p) throw notFound('Payment');
  await prisma.payment.update({ where: { id: paymentId }, data: { status: 'REFUNDED' } });
  return recompute(orgId, p.invoiceId);
}

// ── Credit notes ───────────────────────────────────────────────────────────────
async function issueCreditNote(orgId, id, { amount, reason }) {
  const inv = await get(orgId, id);
  if (Number(amount) > Number(inv.balanceDue)) throw badRequest('Credit exceeds balance due');
  const seq = await ids.nextSeq('creditNote', 'number', orgId);
  await prisma.creditNote.create({ data: { organizationId: orgId, invoiceId: id, number: ids.creditNoteNumber(seq), amount: Number(amount), reason } });
  return recompute(orgId, id);
}

// ── PDF ────────────────────────────────────────────────────────────────────────
async function renderPdf(orgId, id) {
  const inv = await get(orgId, id);
  const html = invoiceHtml(inv);
  const { url } = await pdfLib.htmlToPdfFile(html, { category: 'invoices', filename: `${inv.number.replace(/[^A-Za-z0-9_-]/g, '')}.pdf` });
  return prisma.invoice.update({ where: { id }, data: { pdfUrl: url } });
}

function money(n, cur) {
  try { return new Intl.NumberFormat('en', { style: 'currency', currency: cur }).format(Number(n || 0)); } catch (_) { return `${cur} ${Number(n || 0).toFixed(2)}`; }
}
function invoiceHtml(inv) {
  const c = inv.customer;
  const row = (l) => `<tr><td>${l.description}</td><td style="text-align:right">${Number(l.quantity)}</td><td style="text-align:right">${money(l.unitPrice, inv.currency)}</td><td style="text-align:right">${money(l.amount, inv.currency)}</td></tr>`;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    *{font-family:Arial,Helvetica,sans-serif;box-sizing:border-box}
    body{margin:0;padding:32px;color:#0f172a}
    h1{font-size:26px;margin:0}
    .muted{color:#64748b;font-size:13px}
    table{width:100%;border-collapse:collapse;margin-top:20px}
    th,td{padding:8px;border-bottom:1px solid #e2e8f0;font-size:13px}
    th{text-align:left;background:#f1f5f9}
    .head{display:flex;justify-content:space-between;align-items:flex-start}
    .totals{margin-top:16px;margin-left:auto;width:280px}
    .totals td{border:none;padding:5px 8px}
    .grand td{font-weight:bold;font-size:15px;border-top:2px solid #0f172a}
    .badge{display:inline-block;padding:3px 10px;border-radius:999px;font-size:12px;background:#e2e8f0}
  </style></head><body>
    <div class="head">
      <div><h1>INVOICE</h1><div class="muted">${inv.number}</div></div>
      <div style="text-align:right"><strong>${c.companyName}</strong><br><span class="muted">${c.email || ''} ${c.billingTaxNumber ? '· ' + c.billingTaxNumber : ''}</span><br><span class="badge">${inv.status}</span></div>
    </div>
    <div style="margin-top:20px;font-size:13px">
      <div><strong>Issued:</strong> ${new Date(inv.issueDate).toLocaleDateString()} &nbsp; <strong>Due:</strong> ${new Date(inv.dueDate).toLocaleDateString()}</div>
    </div>
    <table><thead><tr><th>Description</th><th style="text-align:right">Qty</th><th style="text-align:right">Unit</th><th style="text-align:right">Amount</th></tr></thead>
      <tbody>${inv.lines.map(row).join('')}</tbody></table>
    <table class="totals">
      <tr><td>Subtotal</td><td style="text-align:right">${money(inv.subtotal, inv.currency)}</td></tr>
      <tr><td>Tax</td><td style="text-align:right">${money(inv.taxAmount, inv.currency)}</td></tr>
      ${Number(inv.amountPaid) ? `<tr><td>Paid</td><td style="text-align:right">-${money(inv.amountPaid, inv.currency)}</td></tr>` : ''}
      <tr class="grand"><td>${inv.status === 'PAID' ? 'Total Paid' : 'Balance Due'}</td><td style="text-align:right">${money(inv.status === 'PAID' ? inv.totalAmount : inv.balanceDue, inv.currency)}</td></tr>
    </table>
    ${inv.notes ? `<p class="muted" style="margin-top:24px">${inv.notes}</p>` : ''}
  </body></html>`;
}

// ── Aging report ───────────────────────────────────────────────────────────────
/** Classic AR aging buckets by due-date. */
async function agingReport(orgId) {
  const open = await prisma.invoice.findMany({ where: { organizationId: orgId, status: { in: ['SENT', 'PARTIALLY_PAID', 'OVERDUE'] } }, include: { customer: { select: { companyName: true } } } });
  const now = Date.now();
  const buckets = { current: 0, '1_30': 0, '31_60': 0, '61_90': 0, 'over_90': 0 };
  const rows = [];
  for (const inv of open) {
    const days = Math.floor((now - new Date(inv.dueDate).getTime()) / 864e5);
    const amt = Number(inv.balanceDue);
    let key = 'current';
    if (days > 90) key = 'over_90'; else if (days > 60) key = '61_90'; else if (days > 30) key = '31_60'; else if (days > 0) key = '1_30';
    buckets[key] += amt;
    rows.push({ id: inv.id, number: inv.number, customer: inv.customer.companyName, dueDate: inv.dueDate, daysLate: Math.max(0, days), balanceDue: amt, bucket: key });
  }
  const total = Object.values(buckets).reduce((s, v) => s + v, 0);
  return { buckets, total: Number(total.toFixed(2)), invoices: rows };
}

/** Finance KPIs. */
async function kpis(orgId) {
  const [receivable, outstandingCount, overdue, collected] = await Promise.all([
    prisma.invoice.aggregate({ where: { organizationId: orgId, status: { in: ['SENT', 'PARTIALLY_PAID', 'OVERDUE'] } }, _sum: { balanceDue: true } }),
    prisma.invoice.count({ where: { organizationId: orgId, status: { in: ['SENT', 'PARTIALLY_PAID', 'OVERDUE'] } } }),
    prisma.invoice.count({ where: { organizationId: orgId, status: 'OVERDUE' } }),
    prisma.payment.aggregate({ where: { organizationId: orgId, status: 'COMPLETED', paidAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) } }, _sum: { amount: true } }),
  ]);
  return { totalReceivable: Number(receivable._sum.balanceDue || 0), outstandingInvoices: outstandingCount, overdueInvoices: overdue, collectedThisMonth: Number(collected._sum.amount || 0) };
}

// ── Recurring invoices (cron) ──────────────────────────────────────────────────
async function runRecurring(orgId) {
  const due = await prisma.invoice.findMany({ where: { organizationId: orgId, isRecurring: true, status: 'PAID' } });
  const created = [];
  for (const src of due) {
    try {
      const clone = await prisma.invoice.create({
        data: {
          organizationId: orgId, customerId: src.customerId,
          number: ids.invoiceNumber(await ids.nextSeq('invoice', 'number', orgId)),
          status: 'DRAFT', issueDate: new Date(), dueDate: new Date(Date.now() + (TERMS_DAYS[src.customer?.paymentTerms || 'net30'] ?? 30) * 864e5),
          currency: src.currency, subtotal: src.subtotal, taxAmount: src.taxAmount, totalAmount: src.totalAmount, balanceDue: src.totalAmount,
          isRecurring: true, recurrence: src.recurrence,
          lines: { create: src.lines?.map((l) => ({ type: l.type, description: l.description, quantity: l.quantity, unitPrice: l.unitPrice, amount: l.amount })) || [] },
        },
      });
      created.push(clone);
    } catch (_) { /* skip */ }
  }
  return created;
}

module.exports = { list, get, priceOrder, generate, generateAll, update, addLine, removeLine, recompute, send, cancel, recordPayment, createPaymentLink, completeStripePayment, refundPayment, issueCreditNote, renderPdf, agingReport, kpis, runRecurring };
