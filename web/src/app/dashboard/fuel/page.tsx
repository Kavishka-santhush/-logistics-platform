'use client';

import { Fuel, AlertTriangle } from 'lucide-react';
import { PageHeader, StatCard } from '@/components/shared';
import { DataTable, type Column } from '@/components/data-table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { resource } from '@/lib/queries';
import { formatCurrency, formatNumber } from '@/lib/utils';

const fuelApi = resource('/fuel');

interface FuelLog {
  id: string;
  vehicle?: { plateNumber: string } | null;
  liters: string;
  pricePerLiter?: string | null;
  totalCost: string;
  odometerKm?: string | null;
  recordedAt: string;
  isAnomaly?: boolean;
}

export default function FuelPage() {
  const { data, isLoading } = fuelApi.useList({ pageSize: 200 });
  const rows = (data?.data ?? []) as FuelLog[];
  const anomalies = rows.filter((r) => r.isAnomaly);
  const totalLiters = rows.reduce((s, r) => s + Number(r.liters || 0), 0);
  const totalCost = rows.reduce((s, r) => s + Number(r.totalCost || 0), 0);

  const columns: Column<FuelLog>[] = [
    { key: 'vehicle', header: 'Vehicle', accessor: (f) => f.vehicle?.plateNumber ?? '', render: (f) => f.vehicle?.plateNumber || '—' },
    { key: 'liters', header: 'Liters', sortable: true, accessor: (f) => Number(f.liters), render: (f) => `${formatNumber(f.liters)} L` },
    { key: 'pricePerLiter', header: 'Price/L', accessor: (f) => Number(f.pricePerLiter ?? 0), render: (f) => (f.pricePerLiter ? formatCurrency(f.pricePerLiter) : '—') },
    { key: 'totalCost', header: 'Cost', sortable: true, accessor: (f) => Number(f.totalCost), render: (f) => formatCurrency(f.totalCost) },
    { key: 'odometerKm', header: 'Odometer', accessor: (f) => Number(f.odometerKm ?? 0), render: (f) => (f.odometerKm ? `${formatNumber(f.odometerKm)} km` : '—') },
    { key: 'recordedAt', header: 'Date', sortable: true, accessor: (f) => f.recordedAt, render: (f) => new Date(f.recordedAt).toLocaleDateString() },
    { key: 'flag', header: '', render: (f) => (f.isAnomaly ? <Badge variant="destructive"><AlertTriangle className="mr-1 h-3 w-3" />Anomaly</Badge> : null) },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Fuel Management" description="Consumption, cost and anomaly detection." />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard title="Total Liters" value={`${formatNumber(totalLiters)} L`} icon={Fuel} />
        <StatCard title="Total Spend" value={formatCurrency(totalCost)} icon={Fuel} />
        <StatCard title="Anomalies" value={formatNumber(anomalies.length)} icon={AlertTriangle} hint="Suspected irregular fills" />
      </div>

      <DataTable columns={columns} rows={rows} loading={isLoading} searchPlaceholder="Search vehicle…" emptyTitle="No fuel logs" />
    </div>
  );
}
