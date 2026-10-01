'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Copy, Package, MapPin } from 'lucide-react';
import { PageHeader, EmptyState } from '@/components/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/status-badge';
import { ordersApi } from '@/lib/queries';
import { formatCurrency, formatNumber, humanize } from '@/lib/utils';
import type { Order } from '@/types';

export default function OrderDetailPage() {
  const params = useParams<{ id: string }>();
  const { data: order, isLoading } = ordersApi.useOne(params?.id);
  const clone = ordersApi.useClone();
  const o = order as Order | undefined;

  if (isLoading) return <div className="text-sm text-muted-foreground">Loading order…</div>;
  if (!o) return <EmptyState title="Order not found" icon={Package} />;

  const events: any[] = (o as any).events ?? [];
  const packages: any[] = (o as any).packages ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/orders" className="text-muted-foreground hover:text-foreground"><ArrowLeft className="h-5 w-5" /></Link>
        <PageHeader title={o.orderNumber} description={`Tracking ${o.trackingNumber}`} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={o.status} kind="order" />
        <Badge variant="secondary">{humanize(o.type)}</Badge>
        <Badge variant={o.priority === 'URGENT' ? 'destructive' : 'muted'}>{humanize(o.priority)}</Badge>
        {o.isCOD && <Badge variant="warning">COD {formatCurrency(o.codAmount, o.currency)}</Badge>}
        {o.isLate && <Badge variant="destructive">Late</Badge>}
        <div className="ml-auto">
          <Button variant="outline" size="sm" onClick={() => clone.mutate(o.id)} disabled={clone.isPending}><Copy className="mr-1 h-3.5 w-3.5" />Clone</Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Shipment Details</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 text-sm">
            <div><p className="text-muted-foreground">Customer</p><p className="font-medium">{o.customer?.companyName ?? '—'}</p></div>
            <div><p className="text-muted-foreground">Driver</p><p className="font-medium">{o.assignedDriver?.name ?? 'Unassigned'}</p></div>
            <div><p className="text-muted-foreground">Vehicle</p><p className="font-medium">{o.assignedVehicle?.plateNumber ?? '—'}</p></div>
            <div><p className="text-muted-foreground">Charge</p><p className="font-medium">{formatCurrency(o.chargeAmount, o.currency)}</p></div>
            <div><p className="text-muted-foreground">Weight</p><p className="font-medium">{formatNumber(o.totalWeightKg)} kg</p></div>
            <div><p className="text-muted-foreground">Distance</p><p className="font-medium">{o.distanceKm ? `${formatNumber(o.distanceKm)} km` : '—'}</p></div>
            <div className="col-span-2">
              <p className="text-muted-foreground">Route</p>
              <p className="font-medium"><MapPin className="mr-1 inline h-3.5 w-3.5" />{o.pickupCity ?? '—'} → {o.deliveryCity ?? '—'}</p>
              <p className="text-xs text-muted-foreground">{o.deliveryAddressLine}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Packages</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {packages.length === 0 && <p className="text-sm text-muted-foreground">No package records.</p>}
            {packages.map((p: any) => (
              <div key={p.id} className="flex items-center justify-between rounded-md border p-2 text-sm">
                <span>{p.label ?? p.sku ?? p.name ?? 'Package'}</span>
                <span className="text-muted-foreground">{p.status ? humanize(p.status) : ''}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Event Timeline</CardTitle></CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground">No events recorded yet.</p>
          ) : (
            <ol className="relative space-y-4 border-l pl-4">
              {events.map((ev: any, i: number) => (
                <li key={ev.id ?? i} className="relative">
                  <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-primary" />
                  <p className="font-medium text-sm">{humanize(ev.status ?? ev.type ?? 'Event')}</p>
                  <p className="text-xs text-muted-foreground">{ev.note ?? ''} {ev.createdAt ? `· ${new Date(ev.createdAt).toLocaleString()}` : ''}</p>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
