'use client';

import { Warehouse, MapPin } from 'lucide-react';
import { PageHeader } from '@/components/shared';
import { DataTable, type Column } from '@/components/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { warehousesApi } from '@/lib/queries';
import { humanize } from '@/lib/utils';

interface WarehouseRow {
  id: string;
  name: string;
  code?: string;
  city?: string | null;
  country?: string | null;
  totalAreaSqm?: string | number | null;
  capacityPallets?: number | null;
  status?: string;
  zones?: any[];
}

export default function WarehousesPage() {
  const { data, isLoading } = warehousesApi.useList({ pageSize: 200 });
  const rows = (data?.data ?? []) as WarehouseRow[];

  const columns: Column<WarehouseRow>[] = [
    { key: 'name', header: 'Warehouse', sortable: true, render: (w) => (
      <div><p className="font-medium">{w.name}</p>{w.code && <p className="text-xs text-muted-foreground">{w.code}</p>}</div>
    ) },
    { key: 'location', header: 'Location', accessor: (w) => `${w.city ?? ''} ${w.country ?? ''}`.trim(), render: (w) => (
      <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5 text-muted-foreground" />{[w.city, w.country].filter(Boolean).join(', ') || '—'}</span>
    ) },
    { key: 'capacityPallets', header: 'Capacity', sortable: true, accessor: (w) => w.capacityPallets ?? 0, render: (w) => (w.capacityPallets ? `${w.capacityPallets} pallets` : '—') },
    { key: 'area', header: 'Area', accessor: (w) => Number(w.totalAreaSqm ?? 0), render: (w) => (w.totalAreaSqm ? `${w.totalAreaSqm} m²` : '—') },
    { key: 'zones', header: 'Zones', accessor: (w) => w.zones?.length ?? 0, render: (w) => <Badge variant="secondary">{w.zones?.length ?? 0}</Badge> },
    { key: 'status', header: 'Status', render: (w) => <Badge variant={w.status === 'ACTIVE' ? 'success' : 'muted'}>{humanize(w.status ?? 'ACTIVE')}</Badge> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Warehouses" description={`${rows.length} facilities`} actions={<Button><Warehouse className="h-4 w-4" /> Add Warehouse</Button>} />
      <DataTable columns={columns} rows={rows} loading={isLoading} searchPlaceholder="Search warehouse…" emptyTitle="No warehouses yet" />
    </div>
  );
}
