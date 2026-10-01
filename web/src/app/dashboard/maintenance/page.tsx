'use client';

import { Wrench, AlertTriangle } from 'lucide-react';
import { PageHeader } from '@/components/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DataTable, type Column } from '@/components/data-table';
import { Badge } from '@/components/ui/badge';
import { useMaintenanceDue, resource } from '@/lib/queries';
import { formatCurrency, formatNumber, humanize } from '@/lib/utils';

const workOrdersApi = resource('/maintenance');

interface WorkOrder {
  id: string;
  number?: string;
  type?: string;
  status: string;
  vehicle?: { plateNumber: string } | null;
  scheduledDate?: string | null;
  cost?: string | null;
  description?: string | null;
}

const STATUS: Record<string, 'muted' | 'info' | 'warning' | 'success' | 'destructive'> = {
  PLANNED: 'info', IN_PROGRESS: 'warning', COMPLETED: 'success', CANCELLED: 'muted', OVERDUE: 'destructive',
};

export default function MaintenancePage() {
  const { data: due, isLoading: dueLoading } = useMaintenanceDue();
  const { data: list } = workOrdersApi.useList({ pageSize: 200 });
  const dueItems: any[] = (due as any)?.data ?? (Array.isArray(due) ? due : []);
  const rows = (list?.data ?? []) as WorkOrder[];

  const columns: Column<WorkOrder>[] = [
    { key: 'number', header: 'Work Order', render: (w) => <span className="font-medium">{w.number ?? w.id.slice(0, 8)}</span> },
    { key: 'vehicle', header: 'Vehicle', accessor: (w) => w.vehicle?.plateNumber ?? '', render: (w) => w.vehicle?.plateNumber || '—' },
    { key: 'type', header: 'Type', render: (w) => humanize(w.type ?? 'service') },
    { key: 'status', header: 'Status', render: (w) => <Badge variant={STATUS[w.status] ?? 'secondary'}>{humanize(w.status)}</Badge> },
    { key: 'scheduledDate', header: 'Scheduled', accessor: (w) => w.scheduledDate ?? '', render: (w) => (w.scheduledDate ? new Date(w.scheduledDate).toLocaleDateString() : '—') },
    { key: 'cost', header: 'Cost', accessor: (w) => Number(w.cost ?? 0), render: (w) => (w.cost ? formatCurrency(w.cost) : '—') },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Maintenance" description="Work orders and preventive schedules." />

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-warning" /> Due &amp; Overdue</CardTitle></CardHeader>
        <CardContent>
          {dueLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : dueItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing due. Fleet is on schedule.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {dueItems.map((d, i) => (
                <div key={i} className="rounded-md border p-3">
                  <p className="font-medium">{d.vehicle?.plateNumber ?? d.plateNumber ?? 'Vehicle'}</p>
                  <p className="text-xs text-muted-foreground">{humanize(d.type ?? d.task ?? 'Service')}</p>
                  <p className="mt-1 text-xs">{d.dueInKm ? `${formatNumber(d.dueInKm)} km` : ''}{d.dueDate ? ` · ${new Date(d.dueDate).toLocaleDateString()}` : ''}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Wrench className="h-4 w-4" /> Work Orders</CardTitle></CardHeader>
        <CardContent>
          <DataTable columns={columns} rows={rows} searchPlaceholder="Search vehicle or work order…" emptyTitle="No work orders" />
        </CardContent>
      </Card>
    </div>
  );
}
