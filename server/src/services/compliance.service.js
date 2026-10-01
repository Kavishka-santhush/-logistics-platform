const prisma = require('../lib/prisma');
const { crud } = require('../lib/crud');
const { notFound, badRequest } = require('../utils/response.util');
const notificationService = require('./notification.service');

const docCrud = crud('complianceDocument');
const listDocs = (orgId, opts) => docCrud.list(orgId, opts);
const removeDoc = (orgId, id) => docCrud.remove(orgId, id);

/** Upload/register a compliance document (vehicle-, driver- or customer-scoped). */
async function addDocument(orgId, data) {
  if (!data.fileUrl) throw badRequest('fileUrl required (upload first)');
  const doc = await prisma.complianceDocument.create({
    data: {
      organizationId: orgId,
      type: data.type,
      vehicleId: data.vehicleId || null,
      driverId: data.driverId || null,
      customerId: data.customerId || null,
      title: data.title,
      documentNumber: data.documentNumber,
      issuedBy: data.issuedBy,
      issueDate: data.issueDate ? new Date(data.issueDate) : null,
      expiryDate: data.expiryDate ? new Date(data.expiryDate) : null,
      fileUrl: data.fileUrl,
      status: 'PENDING_REVIEW',
      alertLevels: {},
    },
  });
  // Mirror driver license expiry onto the driver record for quick access
  if (data.driverId && data.type === 'DRIVER_LICENSE' && data.expiryDate) {
    await prisma.driver.update({ where: { id: data.driverId }, data: { licenseExpiryDate: new Date(data.expiryDate), licenseScanUrl: data.fileUrl, licenseNumber: data.documentNumber } }).catch(() => {});
  }
  return doc;
}

/** Compliance officer approve/reject. */
async function review(orgId, id, { approve, reviewerId, reason }) {
  const doc = await prisma.complianceDocument.findFirst({ where: { id, organizationId: orgId } });
  if (!doc) throw notFound('Document');
  return prisma.complianceDocument.update({
    where: { id },
    data: { status: approve ? 'APPROVED' : 'REJECTED', reviewedBy: reviewerId, reviewedAt: new Date(), rejectReason: approve ? null : reason },
  });
}

/** Dashboard: valid / expiring soon (<30d) / expired counts + rows. */
async function dashboard(orgId) {
  const now = new Date();
  const soon = new Date(now.getTime() + 30 * 864e5);
  const all = await prisma.complianceDocument.findMany({
    where: { organizationId: orgId },
    include: { vehicle: { select: { plateNumber: true } }, driver: { select: { name: true } } },
    orderBy: { expiryDate: 'asc' },
  });
  const buckets = { valid: [], expiring: [], expired: [] };
  for (const d of all) {
    if (!d.expiryDate) { buckets.valid.push(d); continue; }
    const exp = new Date(d.expiryDate);
    if (exp < now) buckets.expired.push(d);
    else if (exp <= soon) buckets.expiring.push(d);
    else buckets.valid.push(d);
  }
  // driver licenses expiring
  const licenses = await prisma.driver.findMany({ where: { organizationId: orgId, licenseExpiryDate: { lte: soon } }, select: { id: true, name: true, licenseExpiryDate: true } });
  return { counts: { valid: buckets.valid.length, expiring: buckets.expiring.length, expired: buckets.expired.length }, ...buckets, licensesExpiring: licenses };
}

/** Documents crossing a reminder threshold (60/30/14/7/1). Called by cron. */
async function documentsExpiringWithin(days) {
  const until = new Date(Date.now() + days * 864e5);
  return prisma.complianceDocument.findMany({
    where: { expiryDate: { lte: until, gte: new Date(Date.now() - 864e5) }, status: { not: 'REJECTED' } },
    include: { vehicle: { select: { plateNumber: true } }, driver: { select: { name: true, userId: true } }, organization: { select: { name: true } } },
  });
}

/** Mark an alert level as sent for a document (de-dupe reminders). */
async function markAlertSent(docId, level) {
  const doc = await prisma.complianceDocument.findUnique({ where: { id: docId } });
  const levels = { ...(doc.alertLevels || {}), [String(level)]: true };
  return prisma.complianceDocument.update({ where: { id: docId }, data: { alertLevels: levels } });
}

// ── Inspections ────────────────────────────────────────────────────────────────
async function submitInspection(orgId, { vehicleId, driverId, type, results, photoUrls }) {
  const overallPass = (results || []).every((r) => r.pass !== false);
  return prisma.inspectionRecord.create({ data: { organizationId: orgId, vehicleId, driverId: driverId || null, type, results, photoUrls, overallPass } });
}
const listInspections = (orgId, opts) => prisma.inspectionRecord.findMany({ where: { organizationId: orgId }, include: { vehicle: { select: { plateNumber: true } }, driver: { select: { name: true } } }, ...(opts || {}) });

// ── Incidents ──────────────────────────────────────────────────────────────────
async function reportIncident(orgId, data, { userId } = {}) {
  const seq = await require('../utils/ids.util').nextSeq('incidentReport', 'number', orgId);
  return prisma.incidentReport.create({
    data: {
      organizationId: orgId,
      number: require('../utils/ids.util').incidentNumber(seq),
      vehicleId: data.vehicleId || null,
      driverId: data.driverId || null,
      orderId: data.orderId || null,
      type: data.type,
      severity: data.severity || 'LOW',
      occurredAt: new Date(data.occurredAt),
      latitude: data.latitude,
      longitude: data.longitude,
      locationText: data.locationText,
      description: data.description,
      photoUrls: data.photoUrls,
      policeReportRef: data.policeReportRef,
      estimatedLoss: data.estimatedLoss,
    },
  });
}
async function resolveIncident(orgId, id, { resolution, status }) {
  return prisma.incidentReport.update({ where: { id }, data: { resolution, status: status || 'resolved' } });
}
const listIncidents = (orgId, opts) => prisma.incidentReport.findMany({ where: { organizationId: orgId }, include: { vehicle: { select: { plateNumber: true } }, driver: { select: { name: true } } }, orderBy: { createdAt: 'desc' }, ...(opts || {}) });

// ── Audit readiness ────────────────────────────────────────────────────────────
async function auditReadiness(orgId) {
  const d = await dashboard(orgId);
  return {
    ready: d.counts.expired === 0 && d.licensesExpiring.length === 0,
    expiredDocuments: d.counts.expired,
    expiringDocuments: d.counts.expiring,
    licensesExpiring: d.licensesExpiring.length,
    summary: `${d.counts.valid} valid · ${d.counts.expiring} expiring · ${d.counts.expired} expired`,
  };
}

module.exports = { listDocs, addDocument, review, removeDoc, dashboard, documentsExpiringWithin, markAlertSent, submitInspection, listInspections, reportIncident, resolveIncident, listIncidents, auditReadiness };
