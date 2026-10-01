const openrouter = require('../lib/openrouter');
const prisma = require('../lib/prisma');
const config = require('../config');
const analytics = require('./analytics.service');

const DAY = 864e5;
const SYS = 'You are an AI analyst embedded in an enterprise logistics & fleet management platform. Return concise, decision-ready output. When asked for JSON, respond with valid JSON only.';

/**
 * Every AI feature funnels through ask() so we consistently:
 *  - build the domain context from Prisma
 *  - call OpenRouter (which logs spend to AiUsageLog)
 *  - request structured JSON when relevant
 */
async function ask({ feature, system = SYS, prompt, context, json = true, userId, organizationId, temperature }) {
  const messages = [{ role: 'system', content: system }];
  if (context) messages.push({ role: 'system', content: `DATA:\n${typeof context === 'string' ? context : JSON.stringify(context)}` });
  messages.push({ role: 'user', content: prompt });
  const { content, parsed } = await openrouter.chat({ messages, json, temperature: temperature ?? 0.2 }, { organizationId, userId, feature });
  return { result: json ? parsed : content, raw: content };
}

// ── Demand forecasting ──────────────────────────────────────────────────────────
async function demandForecast(orgId, { horizonDays = 14 } = {}) {
  const series = await analytics.timeseries(orgId, { days: 90 });
  return ask({
    feature: 'demand_forecast', organizationId: orgId,
    prompt: `Using the daily order history, forecast total order volume and revenue for the next ${horizonDays} days. Give a per-day point estimate with a confidence band, and flag expected peak days.`,
    context: series,
  });
}

// ── Predictive maintenance ──────────────────────────────────────────────────────
async function predictiveMaintenance(orgId, vehicleId) {
  const [vehicle, telematics, fuelLogs, workOrders, schedules] = await Promise.all([
    prisma.vehicle.findFirst({ where: { id: vehicleId, organizationId: orgId } }),
    prisma.vehicleTelematics.findMany({ where: { vehicleId }, orderBy: { recordedAt: 'desc' }, take: 40 }),
    prisma.fuelLog.findMany({ where: { vehicleId }, orderBy: { date: 'desc' }, take: 20 }),
    prisma.maintenanceWorkOrder.findMany({ where: { vehicleId }, orderBy: { createdAt: 'desc' }, take: 20 }),
    prisma.maintenanceSchedule.findMany({ where: { vehicleId } }),
  ]);
  return ask({
    feature: 'predictive_maintenance', organizationId: orgId,
    prompt: `Assess the health of this vehicle and predict the next likely failure or service need. Return JSON: { riskLevel: "low|medium|high", failureProbability30dPct: number, predictedIssue: string, recommendedAction: string, nextServiceKm: number, confidencePct: number, signals: string[] }.`,
    context: { vehicle, recentTelematics: telematics, fuelLogs, workOrders, schedules },
  });
}

// ── Driver behaviour analysis ───────────────────────────────────────────────────
async function driverAnalyzer(orgId, driverId) {
  const [driver, orders, hos] = await Promise.all([
    prisma.driver.findFirst({ where: { id: driverId, organizationId: orgId } }),
    prisma.order.findMany({ where: { assignedDriverId: driverId, status: { in: ['DELIVERED', 'FAILED'] } }, orderBy: { deliveredAt: 'desc' }, take: 100, select: { status: true, isLate: true, deliveredAt: true, promisedAt: true } }),
    prisma.hoursOfServiceLog.findMany({ where: { driverId }, orderBy: { logDate: 'desc' }, take: 30 }),
  ]);
  const delivered = orders.filter((o) => o.status === 'DELIVERED').length;
  const late = orders.filter((o) => o.isLate).length;
  return ask({
    feature: 'driver_analysis', organizationId: orgId,
    prompt: `Analyse this driver's performance and safety signals. Return JSON: { overallScore: number(0-100), onTimePct: number, safetyAssessment: string, fatigueRisk: "low|medium|high", strengths: string[], improvements: string[], coachingRecommendation: string }.`,
    context: { driver, totals: { handled: orders.length, delivered, late }, hos },
  });
}

// ── Anomaly detection ───────────────────────────────────────────────────────────
async function anomalyDetector(orgId, { days = 7 } = {}) {
  const since = new Date(Date.now() - days * DAY);
  const [fuel, geofenceAlerts, incidents, overspeed] = await Promise.all([
    prisma.fuelLog.findMany({ where: { organizationId: orgId, isAnomaly: true, date: { gte: since } }, select: { vehicleId: true, consumptionPer100Km: true, liters: true, cost: true, date: true, anomalyNote: true } }),
    prisma.geofenceAlert.findMany({ where: { vehicle: { organizationId: orgId }, triggeredAt: { gte: since } }, select: { vehicleId: true, eventType: true, triggeredAt: true } }),
    prisma.incidentReport.findMany({ where: { organizationId: orgId, createdAt: { gte: since } }, select: { type: true, severity: true, vehicleId: true, occurredAt: true } }),
    prisma.vehicleTelematics.findMany({ where: { vehicle: { organizationId: orgId }, recordedAt: { gte: since }, speedKmh: { gte: 120 } }, select: { vehicleId: true, speedKmh: true, recordedAt: true } }),
  ]);
  return ask({
    feature: 'anomaly_detection', organizationId: orgId,
    prompt: `Review operational signals from the last ${days} days and identify anomalies worth investigating (fuel theft/misuse, unusual geofence activity, speeding clusters, incident patterns). Return JSON: { anomalies: [{ category, severity, vehicleId, description, evidence, recommendedAction }] }.`,
    context: { fuel, geofenceAlerts, incidents, overspeed },
  });
}

// ── ETA prediction ──────────────────────────────────────────────────────────────
async function etaPredictor(orgId, orderId) {
  const order = await prisma.order.findFirst({ where: { id: orderId, organizationId: orgId }, include: { assignedVehicle: { select: { type: true, plateNumber: true } }, assignedDriver: { select: { name: true } }, route: { select: { totalDistanceKm: true, totalDurationMin: true } } } });
  if (!order) return { result: null, error: 'Order not found' };
  // historical similar-route durations
  const history = await prisma.order.findMany({ where: { organizationId: orgId, status: 'DELIVERED', distanceKm: { gte: Math.max(0, Number(order.distanceKm || 0) - 10) } }, select: { distanceKm: true, pickedUpAt: true, deliveredAt: true }, take: 50 });
  return ask({
    feature: 'eta_prediction', organizationId: orgId,
    prompt: `Predict the delivery ETA (ISO datetime) for this in-progress order given distance, vehicle type, route duration, and similar historical deliveries. Return JSON: { etaIso: string, confidencePct: number, delayRiskFactors: string[], bufferMinutes: number }.`,
    context: { order, history },
  });
}

// ── Customer churn risk ─────────────────────────────────────────────────────────
async function churnPredictor(orgId, customerId) {
  const trend = await require('./customer.service').orderTrend(orgId, customerId, 6);
  const [perf, breaches] = await Promise.all([
    require('./customer.service').performance(orgId, customerId, { days: 180 }),
    prisma.slaBreach.count({ where: { customerId } }),
  ]);
  return ask({
    feature: 'churn_prediction', organizationId: orgId,
    prompt: `Estimate churn risk for this customer from their order trend, SLA performance, and breach history. Return JSON: { churnRiskPct: number, riskLevel: "low|medium|high", reasons: string[], retentionActions: string[], revenueAtRisk: number }.`,
    context: { trend, performance: perf, slaBreaches: breaches },
  });
}

// ── Natural-language dispatch ───────────────────────────────────────────────────
async function nlDispatch(orgId, instruction, { userId } = {}) {
  const [drivers, vehicles, unassigned] = await Promise.all([
    prisma.driver.findMany({ where: { organizationId: orgId, status: 'ACTIVE' }, select: { id: true, name: true, status: true } }),
    prisma.vehicle.findMany({ where: { organizationId: orgId, status: 'AVAILABLE' }, select: { id: true, plateNumber: true, type: true, weightCapacityKg: true } }),
    prisma.order.findMany({ where: { organizationId: orgId, status: 'CONFIRMED', assignedDriverId: null }, select: { id: true, orderNumber: true, deliveryCity: true, totalWeightKg: true, scheduledDeliveryAt: true }, take: 100 }),
  ]);
  return ask({
    feature: 'nl_dispatch', organizationId: orgId, userId,
    prompt: `You are a dispatch planner. Interpret the operator's instruction and produce an assignment plan. Return JSON: { summary: string, assignments: [{ orderId, driverId, vehicleId, reason }], unassigned: [{ orderId, reason }] }. Only reference IDs present in the provided data.`,
    context: { instruction, drivers, vehicles, unassignedOrders: unassigned },
  });
}

// ── Support chatbot (customer / ops assistant) ──────────────────────────────────
async function chatbot(orgId, question, { userId, orderId, history = [] } = {}) {
  const order = orderId ? await prisma.order.findFirst({ where: { id: orderId, organizationId: orgId }, include: { events: { orderBy: { createdAt: 'desc' }, take: 10 }, shipment: true } }) : null;
  const messages = [
    { role: 'system', content: 'You are a friendly, precise support assistant for a logistics company. Answer using the provided shipment context. If information is missing, say so and suggest next steps.' },
    ...history.map((h) => ({ role: h.role === 'user' ? 'user' : 'assistant', content: h.content })),
    { role: 'user', content: question },
  ];
  if (order) messages.splice(1, 0, { role: 'system', content: `ORDER CONTEXT:\n${JSON.stringify(order)}` });
  const { content } = await openrouter.chat({ messages, json: false, temperature: 0.4 }, { organizationId: orgId, userId, feature: 'chatbot' });
  return { result: content, raw: content };
}

// ── Narrative report generator ──────────────────────────────────────────────────
async function reportNarrative(orgId, { from, to, days = 30 } = {}) {
  const start = from ? new Date(from) : new Date(Date.now() - days * DAY);
  const end = to ? new Date(to) : new Date();
  const [ov, series, costs] = await Promise.all([
    analytics.overview(orgId, { days }),
    analytics.timeseries(orgId, { days }),
    analytics.costSummary(orgId, { days }),
  ]);
  return ask({
    feature: 'report_narrative', organizationId: orgId,
    json: false, temperature: 0.5,
    prompt: `Write an executive summary (200-300 words) of logistics performance for the period. Cover volume, on-time delivery, revenue vs cost, fleet utilisation, and 2-3 concrete recommendations. Plain prose, no markdown headers.`,
    context: { period: { start, end }, overview: ov, series, costs },
  });
}

// ── AI spend telemetry ─────────────────────────────────────────────────────────
async function usageSummary(orgId, { days = 30 } = {}) {
  const since = new Date(Date.now() - days * DAY);
  const [byFeature, totals] = await Promise.all([
    prisma.aiUsageLog.groupBy({ by: ['feature'], where: { organizationId: orgId, createdAt: { gte: since }, success: true }, _sum: { totalTokens: true, estimatedCostUsd: true }, _count: { _all: true } }),
    prisma.aiUsageLog.aggregate({ where: { organizationId: orgId, createdAt: { gte: since } }, _sum: { estimatedCostUsd: true, totalTokens: true }, _count: { _all: true } }),
  ]);
  return { model: config.openrouter.model, windowDays: days, calls: totals._count._all, totalCostUsd: Number(totals._sum.estimatedCostUsd || 0), totalTokens: totals._sum.totalTokens || 0, byFeature: byFeature.map((f) => ({ feature: f.feature, calls: f._count._all, costUsd: Number(f._sum.estimatedCostUsd || 0), tokens: f._sum.totalTokens || 0 })) };
}

module.exports = { demandForecast, predictiveMaintenance, driverAnalyzer, anomalyDetector, etaPredictor, churnPredictor, nlDispatch, chatbot, reportNarrative, usageSummary };
