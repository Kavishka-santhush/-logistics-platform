'use client';

import { Truck, Plus } from 'lucide-react';
import { PageHeader } from '@/components/shared';
import { DataTable, type Column } from '@/components/data-table';
import { StatusBadge } from '@/components/status-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { vehiclesApi } from '@/lib/queries';
import { humanize, formatNumber } from '@/lib/utils';
import type { Vehicle } from '@/types';

export default function FleetPage() {
  const { data, isLoading } = vehiclesApi.useList({ pageSize: 200 });
  const rows = (data?.data ?? []) as Vehicle[];

  const columns: Column<Vehicle>[] = [
    { key: 'plateNumber', header: 'Plate', sortable: true, render: (v) => <span className="font-medium">{v.plateNumber}</span> },
    { key: 'make', header: 'Vehicle', accessor: (v) => `${v.make} ${v.model}`, render: (v) => `${v.make} ${v.model} · ${v.year}` },
    { key: 'type', header: 'Type', render: (v) => <Badge variant="secondary">{humanize(v.type)}</Badge> },
    { key: 'status', header: 'Status', render: (v) => <StatusBadge status={v.status} kind="vehicle" /> },
    { key: 'capacity', header: 'Capacity', accessor: (v) => Number(v.weightCapacityKg), render: (v) => `${formatNumber(v.weightCapacityKg)} kg` },
    { key: 'odometer', header: 'Odometer', accessor: (v) => Number(v.odometerKm), render: (v) => `${formatNumber(v.odometerKm)} km` },
    { key: 'driver', header: 'Driver', accessor: (v) => v.assignedDriver?.name ?? '', render: (v) => v.assignedDriver?.name || <span className="text-muted-foreground">Unassigned</span> },
    { key: 'fuel', header: 'Fuel', render: (v) => humanize(v.fuelType) },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fleet"
        description={`${rows.length} vehicles registered`}
        actions={<Button><Plus className="h-4 w-4" /> Add Vehicle</Button>}
      />
      <DataTable columns={columns} rows={rows} loading={isLoading} searchPlaceholder="Search plate, make, model…" emptyTitle="No vehicles yet" />
    </div>
  );
}
