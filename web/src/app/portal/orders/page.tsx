'use client';

import Link from 'next/link';
import { PageHeader } from '@/components/shared';
import { DataTable, type Column } from '@/components/data-table';
import { StatusBadge } from '@/components/status-badge';
import { ordersApi } from '@/lib/queries';
import { formatCurrency, formatNumber } from '@/lib/utils';
import type { Order } from '@/types';

export default function PortalOrdersPage() {
  const { data, isLoading } = ordersApi.useList({ pageSize: 200 });
  const rows = (data?.data ?? []) as Order[];

  const columns: Column<Order>[] = [
    { key: 'orderNumber', header: 'Order', sortable: true, render: (o) => (
      <div><p className="font-medium">{o.orderNumber}</p><p className="text-xs text-muted-foreground">{o.trackingNumber}</p></div>
    ) },
    { key: 'route', header: 'Route', render: (o) => `${o.pickupCity ?? '—'} → ${o.deliveryCity ?? '—'}` },
    { key: 'weight', header: 'Weight', accessor: (o) => Number(o.totalWeightKg), render: (o) => `${formatNumber(o.totalWeightKg)} kg` },
    { key: 'status', header: 'Status', render: (o) => <StatusBadge status={o.status} kind="order" /> },
    { key: 'chargeAmount', header: 'Charge', accessor: (o) => Number(o.chargeAmount), render: (o) => formatCurrency(o.chargeAmount, o.currency) },
    { key: 'track', header: '', render: (o) => <Link href={`/track/${o.trackingNumber}`} className="text-sm text-primary hover:underline">Track</Link> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="My Orders" description={`${rows.length} shipments`} />
      <DataTable columns={columns} rows={rows} loading={isLoading} searchPlaceholder="Search order…" emptyTitle="No orders yet" />
    </div>
  );
}
