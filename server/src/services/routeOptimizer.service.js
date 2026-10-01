const prisma = require('../lib/prisma');
const gmaps = require('../lib/googlemaps');
const { haversineKm } = require('../utils/haversine.util');
const openrouter = require('../lib/openrouter');
const config = require('../config');
const logger = require('../utils/logger.util');

/**
 * Route optimizer.
 * - `optimizeStops`: nearest-neighbour ordering of delivery stops from a start point,
 *   then a Google Directions pass for authoritative distance/duration + per-stop ETA.
 * - `aiOptimize`: asks the LLM to re-order considering time windows, capacity and
 *   driver hours; falls back to the heuristic result if AI is unavailable.
 */

function nearestNeighbour(start, stops) {
  const remaining = [...stops];
  const ordered = [];
  let cursor = start;
  while (remaining.length) {
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const d = haversineKm(cursor, remaining[i]);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    const next = remaining.splice(bestIdx, 1)[0];
    ordered.push(next);
    cursor = next;
  }
  return ordered;
}

/**
 * @param {Array} stops  [{ lat, lng, orderId, windowStart?, windowEnd?, weightKg? }]
 * @param {Object} start { lat, lng } depot / first pickup
 * @param {Object} opts  { avoidTolls, useAi }
 */
async function optimizeStops({ stops, start, vehicle, opts = {}, meta = {} }) {
  if (!Array.isArray(stops) || stops.length === 0) return { ordered: [], metrics: null };

  let ordered = nearestNeighbour(start, stops);

  if (opts.useAi && config.openrouter.apiKey) {
    try {
      ordered = await aiReorder({ start, stops: ordered, vehicle, meta });
    } catch (err) {
      logger.warn('AI reorder failed, using heuristic', err.message);
    }
  }

  // Authoritative distance/duration via Directions (max 25 waypoints supported)
  let metrics = { totalDistanceKm: null, totalDurationMin: null, perStop: ordered.map((s) => ({ ...s })) };
  if (config.googleMapsApiKey) {
    try {
      const path = [start, ...ordered];
      const dir = await gmaps.directions(path, { avoidTolls: opts.avoidTolls });
      const leg = dir.routes?.[0]?.legs?.[0];
      if (leg) {
        const summary = dir.routes[0];
        const totalMeters = (summary.legs || []).reduce((a, l) => a + (l.distance?.value || 0), 0);
        metrics.totalDistanceKm = Number((totalMeters / 1000).toFixed(2));
        metrics.totalDurationMin = Math.round((summary.legs || []).reduce((a, l) => a + (l.duration_in_traffic?.value || l.duration?.value || 0), 0) / 60);
        // Per-stop cumulative ETA
        let accSec = 0;
        const perStop = [];
        const legs = summary.legs || [];
        for (let i = 0; i < ordered.length; i++) {
          accSec += legs[i]?.duration_in_traffic?.value || legs[i]?.duration?.value || 0;
          perStop.push({
            ...ordered[i],
            etaMinutes: Math.round(accSec / 60),
            distanceFromPrevKm: Number(((legs[i]?.distance?.value || 0) / 1000).toFixed(2)),
          });
        }
        metrics.perStop = perStop;
      }
    } catch (err) {
      logger.warn('Directions call failed, using haversine metrics', err.message);
      metrics.totalDistanceKm = computeStraightLine(start, ordered);
    }
  } else {
    metrics.totalDistanceKm = computeStraightLine(start, ordered);
  }

  return { ordered: metrics.perStop || ordered, metrics };
}

function computeStraightLine(start, ordered) {
  let total = 0;
  let cursor = start;
  for (const s of ordered) {
    total += haversineKm(cursor, s);
    cursor = s;
  }
  return Number(total.toFixed(2));
}

async function aiReorder({ start, stops, vehicle, meta }) {
  const prompt = [
    'You are a logistics route optimization engine. Reorder delivery stops to minimize total travel time while respecting time windows, vehicle capacity, and driver hours.',
    `Start point: ${JSON.stringify(start)}`,
    `Vehicle: ${JSON.stringify({ capacityKg: vehicle?.weightCapacityKg, type: vehicle?.type })}`,
    `Stops: ${JSON.stringify(stops.map((s) => ({ id: s.orderId, lat: s.lat, lng: s.lng, windowStart: s.windowStart, windowEnd: s.windowEnd, weightKg: s.weightKg })))}`,
    'Return JSON: { "orderedStopIds": ["..."], "rationale": "..." }',
  ].join('\n');

  const { parsed } = await openrouter.chat(
    { messages: [{ role: 'user', content: prompt }], json: true },
    { ...meta, feature: 'route_optimizer' }
  );
  if (!parsed?.orderedStopIds) throw new Error('AI returned no order');
  const byId = new Map(stops.map((s) => [s.orderId, s]));
  const reordered = parsed.orderedStopIds.map((id) => byId.get(id)).filter(Boolean);
  // Append any the model dropped
  for (const s of stops) if (!reordered.includes(s)) reordered.push(s);
  return reordered;
}

/** Check aggregate route load vs vehicle capacity. */
function capacityCheck(stops, vehicle) {
  const totalWeight = stops.reduce((a, s) => a + Number(s.weightKg || 0), 0);
  const totalVolume = stops.reduce((a, s) => a + Number(s.volumeM3 || 0), 0);
  return {
    totalWeightKg: totalWeight,
    totalVolumeM3: totalVolume,
    overWeight: vehicle ? totalWeight > Number(vehicle.weightCapacityKg) : false,
    overVolume: vehicle ? totalVolume > Number(vehicle.volumeCapacityM3) : false,
  };
}

module.exports = { optimizeStops, capacityCheck, nearestNeighbour };
