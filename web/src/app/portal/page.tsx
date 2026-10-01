'use client';

import { Package, Timer, CircleDollarSign, CheckCircle2 } from 'lucide-react';
import { PageHeader, StatCard } from '@/components/shared';
import { ordersApi } from '@/lib/queries';
import { formatCurrency, formatNumber } from '@/lib/utils';
import type { Order } from '@/types';

export default function PortalOverviewPage() {
  const { data } = ordersApi.useList({ pageSize: 100 });
  const orders = (data?.data ?? []) as Order[];

  const active = orders.filter((o) => !['DELIVERED', 'CANCELLED', 'RETURNED'].includes(o.status));
  const delivered = orders.filter((o) => o.status === 'DELIVERED');
  const late = orders.filter((o) => o.isLate);
  const spend = orders.reduce((s, o) => s + Number(o.chargeAmount ?? 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Welcome back" description="Track your shipments and manage billing." />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Active Shipments" value={formatNumber(active.length)} icon={Package} />
        <StatCard title="Delivered" value={formatNumber(delivered.length)} icon={CheckCircle2} />
        <StatCard title="Late" value={formatNumber(late.length)} icon={Timer} />
        <StatCard title="Total Spend" value={formatCurrency(spend, 'EUR')} icon={CircleDollarSign} />
      </div>
    </div>
  );
}
