/**
 * Geospatial helpers — Haversine great-circle distance + bearing.
 * Coordinates are { lat, lng } decimal degrees. Distances returned in km/meters.
 */
const R_EARTH_KM = 6371;
const toRad = (deg) => (deg * Math.PI) / 180;
const toDeg = (rad) => (rad * 180) / Math.PI;

/** Great-circle distance between two points, in kilometers. */
function haversineKm(a, b) {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R_EARTH_KM * Math.asin(Math.sqrt(h));
}

const haversineMeters = (a, b) => haversineKm(a, b) * 1000;

/** Initial bearing (deg) from a → b, used for heading calc between GPS points. */
function bearing(a, b) {
  const y = Math.sin(toRad(b.lng - a.lng)) * Math.cos(toRad(b.lat));
  const x =
    Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) -
    Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(toRad(b.lng - a.lng));
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/** Total polyline length in km. */
function pathLengthKm(points) {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += haversineKm(points[i - 1], points[i]);
  return total;
}

/** Point → nearest coordinate on a polyline (for deviation detection). */
function distanceToPathMeters(point, path) {
  let min = Infinity;
  for (let i = 1; i < path.length; i++) {
    const d = pointSegmentDistance(point, path[i - 1], path[i]);
    if (d < min) min = d;
  }
  return min === Infinity ? null : min * 1000;
}

function pointSegmentDistance(p, a, b) {
  const ab = haversineKm(a, b);
  if (ab === 0) return haversineKm(p, a);
  const ap = haversineKm(a, p);
  const bp = haversineKm(b, p);
  const s = (ap + bp + ab) / 2;
  const area = Math.sqrt(Math.max(0, s * (s - ab) * (s - ap) * (s - bp)));
  return (2 * area) / ab;
}

module.exports = {
  haversineKm,
  haversineMeters,
  bearing,
  pathLengthKm,
  distanceToPathMeters,
  toRad,
  toDeg,
};
