'use client';

import { useMemo } from 'react';
import { GoogleMap, MarkerF, useJsApiLoader, PolylineF } from '@react-google-maps/api';

const LIBRARIES: ('markers')[] = ['markers'];

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  label?: string;
  onClick?: () => void;
}

export function MapView({
  center = { lat: 51.9244, lng: 4.4777 },
  markers = [],
  polyline,
  zoom = 9,
  height = '100%',
  onMapClick,
}: {
  center?: { lat: number; lng: number };
  markers?: MapMarker[];
  polyline?: { lat: number; lng: number }[];
  zoom?: number;
  height?: string;
  onMapClick?: (latlng: { lat: number; lng: number }) => void;
}) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const { isLoaded } = useJsApiLoader({
    id: 'gmaps',
    googleMapsApiKey: apiKey || '',
    libraries: LIBRARIES,
  });

  const containerStyle = useMemo(() => ({ width: '100%', height }), [height]);

  if (!apiKey) {
    return (
      <div className="flex items-center justify-center rounded-lg border bg-muted text-sm text-muted-foreground" style={{ height }}>
        Set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to enable the map
      </div>
    );
  }
  if (!isLoaded) {
    return <div className="flex items-center justify-center rounded-lg bg-muted" style={{ height }}><span className="text-sm text-muted-foreground">Loading map…</span></div>;
  }

  return (
    <GoogleMap
      mapContainerStyle={containerStyle}
      center={center}
      zoom={zoom}
      onClick={(e) => e && onMapClick?.({ lat: e.latLng?.lat() ?? 0, lng: e.latLng?.lng() ?? 0 })}
    >
      {polyline && polyline.length > 1 && (
        <PolylineF path={polyline} options={{ strokeColor: '#2563eb', strokeWeight: 3 }} />
      )}
      {markers.map((m) => (
        <MarkerF key={m.id} position={{ lat: m.lat, lng: m.lng }} onClick={m.onClick} title={m.label} />
      ))}
    </GoogleMap>
  );
}
