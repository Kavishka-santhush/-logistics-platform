'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Package, Plus } from 'lucide-react';
import { PageHeader } from '@/components/shared';
import { DataTable, type Column } from '@/components/data-table';
import { StatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/input';
import { ordersApi } from '@/lib/queries';
import { formatCurrency, formatNumber, humanize } from '@/lib/utils';
import type { Order } from '@/types';

export default function OrdersPage() {
  const [status, setStatus] = useState('');
  const { data, isLoading } = ordersApi.useList({ pageSize: 200, status: status || undefined });
  const rows = (data?.data ?? []) as Order[];

  const columns: Column<Order>[] = [
    { key: 'orderNumber', header: 'Order', sortable: true, render: (o) => (
      <div>
        <Link href={`/dashboard/orders/${o.id}`} className="font-medium text-primary hover:underline">{o.orderNumber}</Link>
        <p className="text-xs text-muted-foreground">{o.trackingNumber}</p>
      </div>
    ) },
    { key: 'customer', header: 'Customer', accessor: (o) => o.customer?.companyName ?? '', render: (o) => o.customer?.companyName || '—' },
    { key: 'type', header: 'Type', render: (o) => humanize(o.type) },
    { key: 'status', header: 'Status', render: (o) => <StatusBadge status={o.status} kind="order" /> },
    { key: 'route', header: 'Route', render: (o) => <span className="text-xs text-muted-foreground">{o.pickupCity} → {o.deliveryCity}</span> },
    { key: 'weight', header: 'Weight', accessor: (o) => Number(o.totalWeightKg), render: (o) => `${formatNumber(o.totalWeightKg)} kg` },
    { key: 'chargeAmount', header: 'Charge', sortable: true, accessor: (o) => Number(o.chargeAmount), render: (o) => formatCurrency(o.chargeAmount, o.currency) },
    { key: 'driver', header: 'Driver', accessor: (o) => o.assignedDriver?.name ?? '', render: (o) => o.assignedDriver?.name || <span className="text-muted-foreground">Unassigned</span> },
    { key: 'createdAt', header: 'Created', sortable: true, accessor: (o) => o.createdAt, render: (o) => new Date(o.createdAt).toLocaleDateString() },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Orders" description={`${rows.length} orders`} actions={<Button><Plus className="h-4 w-4" /> New Order</Button>} />
      <DataTable
        columns={columns}
        rows={rows}
        loading={isLoading}
        searchPlaceholder="Search order or tracking number…"
        emptyTitle="No orders match"
        toolbar={
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-44">
            <option value="">All statuses</option>
            {['DRAFT', 'CONFIRMED', 'ASSIGNED', 'PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'FAILED', 'RETURNED', 'CANCELLED'].map((s) => (
              <option key={s} value={s}>{humanize(s)}</option>
            ))}
          </Select>
        }
      />
    </div>
  );
}
