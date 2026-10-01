import * as Location from 'expo-location';
import { api } from './api';

/**
 * Live GPS reporting. Foreground polling is used while on duty; the same fixes
 * are POSTed to /tracking/ingest (REST) as a durable fallback to Socket.io.
 */

export async function ensureLocationPermission(): Promise<boolean> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  return status === 'granted';
}

/**
 * Starts a 15s polling loop that ingests the driver's position for the given
 * vehicle. Returns a stop() function. Safe to call from a screen effect.
 */
export function startTracking(vehicleId: string, orgId: string | null, driverId: string | null): () => void {
  let stopped = false;
  const timer = setInterval(async () => {
    if (stopped) return;
    try {
      const pos = await Location.getLastKnownPositionAsync({ maxAge: 30_000 });
      if (!pos) return;
      const payload = {
        vehicleId,
        driverId: driverId ?? undefined,
        organizationId: orgId ?? undefined,
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        speedKmh: pos.coords.speed != null ? Math.max(0, pos.coords.speed * 3.6) : undefined,
        heading: pos.coords.heading ?? undefined,
      };
      await api.post('/tracking/ingest', payload);
    } catch {
      /* transient network errors are ignored; next tick retries */
    }
  }, 15_000);

  return () => {
    stopped = true;
    clearInterval(timer);
  };
}
