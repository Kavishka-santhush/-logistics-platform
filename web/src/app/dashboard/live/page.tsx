'use client';

import { useMemo, useState } from 'react';
import { Radar, Truck, Zap } from 'lucide-react';
import { PageHeader, EmptyState } from '@/components/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapView, type MapMarker } from '@/components/map-view';
import { useLiveVehicles } from '@/lib/queries';
import { useSocketEvent } from '@/lib/socket';
import { formatNumber } from '@/lib/utils';
import type { LiveVehicle } from '@/types';

export default function LiveTrackingPage() {
  const { data, isLoading } = useLiveVehicles();
  const [live, setLive] = useState<Record<string, LiveVehicle>>({});
  const [selected, setSelected] = useState<LiveVehicle | null>(null);

  const baseVehicles: LiveVehicle[] = useMemo(() => {
    const arr = (Array.isArray(data) ? data : (data as any)?.data ?? []) as LiveVehicle[];
    const merged = new Map<string, LiveVehicle>();
    for (const v of arr) merged.set(v.vehicleId, v);
    for (const [id, v] of Object.entries(live)) merged.set(id, v);
    return [...merged.values()];
  }, [data, live]);

  // Merge streaming GPS updates pushed over Socket.io.
  useSocketEvent<LiveVehicle>('vehicle:location', (payload) => {
    if (!payload?.vehicleId) return;
    setLive((prev) => ({ ...prev, [payload.vehicleId]: payload }));
  });

  const markers: MapMarker[] = baseVehicles.map((v) => ({
    id: v.vehicleId,
    lat: v.latitude,
    lng: v.longitude,
    label: `${v.plateNumber}${v.driverName ? ' · ' + v.driverName : ''}`,
    onClick: () => setSelected(v),
  }));

  const center = baseVehicles[0] ? { lat: baseVehicles[0].latitude, lng: baseVehicles[0].longitude } : undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Live Tracking"
        description="Real-time vehicle positions updated over Socket.io."
        actions={<Badge variant={baseVehicles.length ? 'success' : 'muted'}><Radar className="mr-1 h-3 w-3" />{baseVehicles.length} on the road</Badge>}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>Fleet Map</CardTitle>
            {selected && (
              <span className="text-sm text-muted-foreground">
                <Truck className="mr-1 inline h-4 w-4" />
                {selected.plateNumber} · {formatNumber(selected.speedKmh)} km/h
              </span>
            )}
          </CardHeader>
          <CardContent>
            <div className="h-[520px] overflow-hidden rounded-lg border">
              {isLoading ? (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Loading positions…</div>
              ) : baseVehicles.length ? (
                <MapView markers={markers} center={center} zoom={10} height="100%" />
              ) : (
                <EmptyState title="No vehicles transmitting" description="Live positions appear here once vehicles start reporting GPS." icon={Radar} />
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Vehicles</CardTitle></CardHeader>
          <CardContent className="max-h-[520px] space-y-2 overflow-y-auto">
            {baseVehicles.map((v) => (
              <button
                key={v.vehicleId}
                onClick={() => setSelected(v)}
                className={`w-full rounded-md border p-3 text-left transition-colors hover:bg-accent ${selected?.vehicleId === v.vehicleId ? 'border-primary bg-accent' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{v.plateNumber}</span>
                  <Badge variant={v.engineOn ? 'success' : 'muted'}><Zap className="mr-1 h-3 w-3" />{v.engineOn ? 'On' : 'Idle'}</Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{v.driverName || 'No driver'} · {formatNumber(v.speedKmh)} km/h</p>
                <p className="text-xs text-muted-foreground">{v.latitude.toFixed(4)}, {v.longitude.toFixed(4)}</p>
              </button>
            ))}
            {!baseVehicles.length && <p className="text-sm text-muted-foreground">No vehicles online.</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
