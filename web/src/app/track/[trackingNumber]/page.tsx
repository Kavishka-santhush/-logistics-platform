'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle2, Truck, Package, MapPin, Star } from 'lucide-react';
import { usePublicTracking } from '@/lib/queries';
import { StatusBadge } from '@/components/status-badge';
import { humanize } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const FLOW = ['CONFIRMED', 'PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED'];

export default function TrackResultPage() {
  const params = useParams<{ trackingNumber: string }>();
  const code = params?.trackingNumber;
  const { data, isLoading, isError } = usePublicTracking(code);
  const order = data?.order ?? data;

  return (
    <div className="mx-auto max-w-3xl p-6">
      <Link href="/track" className="mb-4 inline-flex items-center gap-1 text-sm text-primary">
        ← Track another shipment
      </Link>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2"><Package className="h-5 w-5" /> Shipment {code}</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              {order?.customer?.companyName ? `For ${order.customer.companyName}` : 'Live status'}
            </p>
          </div>
          {order && <StatusBadge status={order.status} kind="order" />}
        </CardHeader>
        <CardContent className="space-y-6">
          {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {isError && <p className="text-sm text-destructive">Tracking number not found.</p>}

          {order && (
            <>
              <ol className="relative space-y-6 border-l pl-6">
                {FLOW.map((step, idx) => {
                  const reached = idx <= FLOW.indexOf(order.status);
                  return (
                    <li key={step} className="relative">
                      <span className={`absolute -left-[31px] flex h-5 w-5 items-center justify-center rounded-full ${reached ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                        {reached ? <CheckCircle2 className="h-3.5 w-3.5" /> : <span className="h-2 w-2 rounded-full bg-muted-foreground" />}
                      </span>
                      <p className={`text-sm font-medium ${reached ? '' : 'text-muted-foreground'}`}>{humanize(step)}</p>
                      {step === order.status && order.deliveredAt && (
                        <p className="text-xs text-muted-foreground">{new Date(order.deliveredAt).toLocaleString()}</p>
                      )}
                    </li>
                  );
                })}
              </ol>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border p-3">
                  <p className="flex items-center gap-2 text-sm font-medium"><MapPin className="h-4 w-4" /> Delivery</p>
                  <p className="mt-1 text-sm text-muted-foreground">{order.deliveryAddressLine}, {order.deliveryCity}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="flex items-center gap-2 text-sm font-medium"><Truck className="h-4 w-4" /> Courier</p>
                  <p className="mt-1 text-sm text-muted-foreground">{order.assignedDriver?.name || 'Assigning…'}</p>
                </div>
              </div>

              {order.etaAt && (
                <div className="rounded-lg bg-info/10 p-3 text-sm text-info">
                  Estimated delivery: <strong>{new Date(order.etaAt).toLocaleString()}</strong>
                </div>
              )}

              {order.status === 'DELIVERED' && order.rating && (
                <div className="flex items-center gap-2 rounded-lg border p-3">
                  <div className="flex">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className={`h-4 w-4 ${i < order.rating.stars ? 'fill-warning text-warning' : 'text-muted'}`} />
                    ))}
                  </div>
                  <span className="text-sm text-muted-foreground">{order.rating.comment || 'Thank you for rating'}</span>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
