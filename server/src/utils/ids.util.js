const crypto = require('crypto');
const prisma = require('../lib/prisma');

/** Collision-resistant human-readable business identifiers. */

function pad(n, width = 4) {
  return String(n).padStart(width, '0');
}

function ymd(date = new Date()) {
  return date.toISOString().slice(0, 10).replace(/-/g, '');
}

const rand = (len = 4) =>
  crypto
    .randomBytes(len)
    .toString('hex')
    .toUpperCase()
    .slice(0, len);

// ORD-20260101-000123
const orderNumber = (seq) => `ORD-${ymd()}-${pad(seq, 6)}`;
// TRK7F3A9C21 (public tracking code, embedded in QR)
const trackingNumber = () => `TRK${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
// PKG barcode
const barcode = () => `PKG${Date.now().toString(36).toUpperCase()}${rand(4)}`;
// INV-202601-000045
const invoiceNumber = (seq) =>
  `INV-${new Date().toISOString().slice(0, 7).replace('-', '')}-${pad(seq, 5)}`;
const workOrderNumber = (seq) => `MWO-${ymd()}-${pad(seq, 4)}`;
const incidentNumber = (seq) => `INC-${ymd()}-${pad(seq, 4)}`;
const grnNumber = (seq) => `GRN-${ymd()}-${pad(seq, 4)}`;
const creditNoteNumber = (seq) => `CN-${ymd()}-${pad(seq, 4)}`;

/** Compute next sequence for a model by reading the most recent business number. */
async function nextSeq(model, field, orgId = null) {
  const where = orgId ? { organizationId: orgId } : {};
  const last = await prisma[model].findFirst({
    where,
    orderBy: { createdAt: 'desc' },
    select: { [field]: true },
  });
  const current = last?.[field] ? parseInt(String(last[field]).split('-').pop(), 10) || 0 : 0;
  return current + 1;
}

module.exports = {
  orderNumber,
  trackingNumber,
  barcode,
  invoiceNumber,
  workOrderNumber,
  incidentNumber,
  grnNumber,
  creditNoteNumber,
  nextSeq,
  rand,
  pad,
};
