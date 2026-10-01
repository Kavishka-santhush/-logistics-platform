const config = require('../config');
const logger = require('../utils/logger.util');

const BASE = 'https://maps.googleapis.com/maps/api';

async function get(path, params) {
  const url = new URL(`${BASE}/${path}`);
  Object.entries({ ...params, key: config.googleMapsApiKey }).forEach(([k, v]) => {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  });
  const res = await fetch(url);
  const json = await res.json();
  if (json.status && json.status !== 'OK' && json.status !== 'ZERO_RESULTS') {
    logger.warn(`Google ${path} → ${json.status} ${json.error_message || ''}`);
  }
  return json;
}

const fmt = (p) => `${Number(p.lat).toFixed(6)},${Number(p.lng).toFixed(6)}`;

/** Directions between an ordered list of {lat,lng} points (origin + waypoints + destination). */
async function directions(points, { avoidTolls = false, avoidHighways = false, departureTime, trafficModel = 'bestguess' } = {}) {
  if (!points || points.length < 2) throw new Error('Need at least two points');
  const params = {
    origin: fmt(points[0]),
    destination: fmt(points[points.length - 1]),
    mode: 'driving',
    departure_time: departureTime || 'now',
    traffic_model: trafficModel,
    avoid: [avoidTolls && 'tolls', avoidHighways && 'highways'].filter(Boolean).join('|') || undefined,
  };
  if (points.length > 2) params.waypoints = `optimize:true|${points.slice(1, -1).map(fmt).join('|')}`;
  return get('json', params);
}

/** Distance Matrix between origins[] and destinations[]. */
async function distanceMatrix(origins, destinations, opts = {}) {
  return get('distancematrix/json', {
    origins: origins.map(fmt).join('|'),
    destinations: destinations.map(fmt).join('|'),
    mode: 'driving',
    ...opts,
  });
}

/** Geocode a free-form address → lat/lng + formatted address. */
async function geocode(address) {
  const json = await get('geocode/json', { address });
  const r = json.results?.[0];
  if (!r) return null;
  return {
    lat: r.geometry.location.lat,
    lng: r.geometry.location.lng,
    formattedAddress: r.formatted_address,
    placeId: r.place_id,
  };
}

/** Reverse geocode lat/lng → address. */
async function reverseGeocode(lat, lng) {
  const json = await get('geocode/json', { latlng: `${lat},${lng}` });
  return json.results?.[0]?.formatted_address || null;
}

/** Places text search (autosuggest for address fields). */
async function placeTextSearch(query) {
  return get('places/textsearch/json', { query });
}

module.exports = { directions, distanceMatrix, geocode, reverseGeocode, placeTextSearch, fmt };
