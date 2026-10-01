const { haversineMeters } = require('./haversine.util');

/**
 * Geofence geometry — supports circular and polygonal zones.
 * Polygon coordinates stored as [[lat, lng], ...] (JSONB).
 */

function insideCircle(point, fence) {
  const center = { lat: Number(fence.centerLat), lng: Number(fence.centerLng) };
  return haversineMeters(point, center) <= Number(fence.radiusM);
}

/** Ray-casting point-in-polygon (lat/lng treated as planar — fine at city scale). */
function insidePolygon(point, polygon) {
  const { lat: y, lng: x } = point;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [yi, xi] = polygon[i];
    const [yj, xj] = polygon[j];
    const intersects =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

/** Returns true if the point is within the geofence boundary. */
function isInside(point, fence) {
  const p = { lat: Number(point.lat ?? point.latitude), lng: Number(point.lng ?? point.longitude) };
  if (fence.type === 'polygon' && Array.isArray(fence.polygon)) {
    return insidePolygon(p, fence.polygon);
  }
  return insideCircle(p, fence);
}

/**
 * Detect transition given previous & current containment.
 * Returns 'enter' | 'exit' | null.
 */
function detectTransition(wasInside, isNowInside, alertOn = {}) {
  if (!wasInside && isNowInside && alertOn.enter !== false) return 'enter';
  if (wasInside && !isNowInside && alertOn.exit !== false) return 'exit';
  return null;
}

module.exports = { isInside, insideCircle, insidePolygon, detectTransition };
