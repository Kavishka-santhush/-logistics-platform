'use client';

import { Boxes, AlertOctagon } from 'lucide-react';
import { PageHeader } from '@/components/shared';
import { DataTable, type Column } from '@/components/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { inventoryApi } from '@/lib/queries';
import { formatNumber } from '@/lib/utils';

interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  quantity: number;
  reservedQuantity?: number;
  reorderLevel?: number | null;
  unitCost?: string | number | null;
  warehouse?: { name: string } | null;
  category?: string | null;
}

export default function InventoryPage() {
  const { data, isLoading } = inventoryApi.useList({ pageSize: 500 });
  const rows = (data?.data ?? []) as InventoryItem[];

  const columns: Column<InventoryItem>[] = [
    { key: 'sku', header: 'SKU', sortable: true, render: (i) => <span className="font-mono text-xs">{i.sku}</span> },
    { key: 'name', header: 'Item', sortable: true, render: (i) => <span className="font-medium">{i.name}</span> },
    { key: 'category', header: 'Category', render: (i) => i.category || '—' },
    { key: 'warehouse', header: 'Warehouse', accessor: (i) => i.warehouse?.name ?? '', render: (i) => i.warehouse?.name || '—' },
    { key: 'quantity', header: 'On hand', sortable: true, accessor: (i) => i.quantity, render: (i) => formatNumber(i.quantity) },
    { key: 'reservedQuantity', header: 'Reserved', accessor: (i) => i.reservedQuantity ?? 0, render: (i) => formatNumber(i.reservedQuantity ?? 0) },
    { key: 'available', header: 'Available', accessor: (i) => i.quantity - (i.reservedQuantity ?? 0), render: (i) => formatNumber(i.quantity - (i.reservedQuantity ?? 0)) },
    { key: 'reorder', header: 'Status', accessor: (i) => (i.reorderLevel != null && i.quantity <= i.reorderLevel ? 0 : 1), render: (i) => {
      const low = i.reorderLevel != null && i.quantity <= i.reorderLevel;
      return low ? <Badge variant="destructive"><AlertOctagon className="mr-1 h-3 w-3" />Reorder</Badge> : <Badge variant="success">In stock</Badge>;
    } },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Inventory" description={`${rows.length} SKUs tracked`} actions={<Button><Boxes className="h-4 w-4" /> Adjust Stock</Button>} />
      <DataTable columns={columns} rows={rows} loading={isLoading} searchPlaceholder="Search SKU or item…" emptyTitle="No inventory items" />
    </div>
  );
}
