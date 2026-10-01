'use client';

import { Users, Plus, Star } from 'lucide-react';
import { PageHeader } from '@/components/shared';
import { DataTable, type Column } from '@/components/data-table';
import { StatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { driversApi } from '@/lib/queries';
import { formatNumber } from '@/lib/utils';
import type { Driver } from '@/types';

export default function DriversPage() {
  const { data, isLoading } = driversApi.useList({ pageSize: 200 });
  const rows = (data?.data ?? []) as Driver[];

  const columns: Column<Driver>[] = [
    { key: 'name', header: 'Driver', sortable: true, render: (d) => (
      <div>
        <p className="font-medium">{d.name}</p>
        <p className="text-xs text-muted-foreground">{d.employeeId}</p>
      </div>
    ) },
    { key: 'phone', header: 'Phone', render: (d) => d.phone },
    { key: 'status', header: 'Status', render: (d) => <StatusBadge status={d.status} kind="driver" /> },
    { key: 'ratingAvg', header: 'Rating', sortable: true, accessor: (d) => Number(d.ratingAvg), render: (d) => (
      <span className="inline-flex items-center gap-1"><Star className="h-3.5 w-3.5 fill-warning text-warning" /> {Number(d.ratingAvg).toFixed(1)} <span className="text-xs text-muted-foreground">({d.ratingCount})</span></span>
    ) },
    { key: 'performanceScore', header: 'Score', sortable: true, accessor: (d) => Number(d.performanceScore), render: (d) => <span className="font-medium">{formatNumber(d.performanceScore)}</span> },
    { key: 'onTimeRate', header: 'On-time', accessor: (d) => Number(d.onTimeRate), render: (d) => `${formatNumber(d.onTimeRate)}%` },
    { key: 'violationCount', header: 'Violations', accessor: (d) => d.violationCount, render: (d) => d.violationCount > 0 ? <span className="text-destructive">{d.violationCount}</span> : '0' },
    { key: 'licenseExpiryDate', header: 'License Expiry', accessor: (d) => d.licenseExpiryDate, render: (d) => (
      <span className={new Date(d.licenseExpiryDate || 0) < new Date() ? 'text-destructive' : ''}>{d.licenseExpiryDate ? new Date(d.licenseExpiryDate).toLocaleDateString() : '—'}</span>
    ) },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Drivers" description={`${rows.length} drivers`} actions={<Button><Plus className="h-4 w-4" /> Add Driver</Button>} />
      <DataTable columns={columns} rows={rows} loading={isLoading} searchPlaceholder="Search name or employee ID…" emptyTitle="No drivers yet" />
    </div>
  );
}
