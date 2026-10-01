'use client';

import { useState } from 'react';
import { MapPin, Package, UserPlus } from 'lucide-react';
import { PageHeader } from '@/components/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/status-badge';
import { useDispatchBoard, useAssignDispatch, ordersApi, driversApi, vehiclesApi } from '@/lib/queries';
import { humanize } from '@/lib/utils';
import type { Order, Driver, Vehicle } from '@/types';

export default function DispatchPage() {
  const { data: board, isLoading } = useDispatchBoard();
  const { data: ordersData } = ordersApi.useList({ pageSize: 200, status: 'CONFIRMED' });
  const { data: driversData } = driversApi.useList({ pageSize: 200 });
  const { data: vehiclesData } = vehiclesApi.useList({ pageSize: 200, status: 'AVAILABLE' });
  const assign = useAssignDispatch();

  const unassigned = (ordersData?.data ?? []) as Order[];
  const drivers = (driversData?.data ?? []) as Driver[];
  const vehicles = (vehiclesData?.data ?? []) as Vehicle[];
  const boardRows = (board as any)?.data ?? (Array.isArray(board) ? board : []);

  const [picking, setPicking] = useState<Order | null>(null);
  const [driverId, setDriverId] = useState('');
  const [vehicleId, setVehicleId] = useState('');

  function confirmAssign() {
    if (!picking || !driverId) return;
    assign.mutate({ orderId: picking.id, driverId, vehicleId: vehicleId || undefined }, {
      onSuccess: () => { setPicking(null); setDriverId(''); setVehicleId(''); },
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Dispatch Board" description="Assign confirmed orders to drivers and vehicles." actions={<Badge variant="secondary"><MapPin className="mr-1 h-3 w-3" />{boardRows.length} active dispatches</Badge>} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Awaiting Assignment</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {unassigned.length === 0 && <p className="text-sm text-muted-foreground">No orders waiting for dispatch.</p>}
            {unassigned.map((o) => (
              <div key={o.id} className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <p className="font-medium">{o.orderNumber}</p>
                  <p className="text-xs text-muted-foreground">{o.pickupCity} → {o.deliveryCity} · {humanize(o.type)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={o.status} kind="order" />
                  <Button size="sm" variant="outline" onClick={() => setPicking(o)}><UserPlus className="mr-1 h-3.5 w-3.5" />Assign</Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Active Dispatches</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {boardRows.length === 0 && <p className="text-sm text-muted-foreground">No dispatches today.</p>}
            {boardRows.map((d: any) => (
              <div key={d.id} className="rounded-md border p-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{d.order?.orderNumber ?? d.orderId}</span>
                  <Badge variant="info">{humanize(d.status ?? 'ASSIGNED')}</Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  <Package className="mr-1 inline h-3 w-3" />
                  {d.driver?.name ?? 'Driver TBC'} · {d.vehicle?.plateNumber ?? 'Vehicle TBC'}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {picking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setPicking(null)}>
          <Card className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <CardHeader><CardTitle>Assign {picking.orderNumber}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="mb-1 text-sm font-medium">Driver</p>
                <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm" value={driverId} onChange={(e) => setDriverId(e.target.value)}>
                  <option value="">Select driver…</option>
                  {drivers.map((d) => <option key={d.id} value={d.id}>{d.name} ({d.employeeId})</option>)}
                </select>
              </div>
              <div>
                <p className="mb-1 text-sm font-medium">Vehicle (optional)</p>
                <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm" value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}>
                  <option value="">Unassigned</option>
                  {vehicles.map((v) => <option key={v.id} value={v.id}>{v.plateNumber} · {v.make} {v.model}</option>)}
                </select>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setPicking(null)}>Cancel</Button>
                <Button onClick={confirmAssign} disabled={!driverId || assign.isPending}>{assign.isPending ? 'Assigning…' : 'Confirm Assign'}</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
