'use client';

import { PageHeader } from '@/components/shared';
import { DataTable, type Column } from '@/components/data-table';
import { StatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { invoicesApi } from '@/lib/queries';
import { formatCurrency } from '@/lib/utils';
import type { Invoice } from '@/types';

export default function PortalInvoicesPage() {
  const { data, isLoading } = invoicesApi.useList({ pageSize: 200 });
  const rows = (data?.data ?? []) as Invoice[];

  const columns: Column<Invoice>[] = [
    { key: 'number', header: 'Invoice', sortable: true, render: (i) => <span className="font-medium">{i.number}</span> },
    { key: 'issueDate', header: 'Issued', sortable: true, accessor: (i) => i.issueDate, render: (i) => new Date(i.issueDate).toLocaleDateString() },
    { key: 'dueDate', header: 'Due', sortable: true, accessor: (i) => i.dueDate, render: (i) => new Date(i.dueDate).toLocaleDateString() },
    { key: 'status', header: 'Status', render: (i) => <StatusBadge status={i.status} kind="invoice" /> },
    { key: 'totalAmount', header: 'Total', accessor: (i) => Number(i.totalAmount), render: (i) => formatCurrency(i.totalAmount, i.currency) },
    { key: 'balanceDue', header: 'Balance', accessor: (i) => Number(i.balanceDue), render: (i) => (
      Number(i.balanceDue) > 0 ? <span className="font-medium text-destructive">{formatCurrency(i.balanceDue, i.currency)}</span> : formatCurrency(i.balanceDue, i.currency)
    ) },
    { key: 'pay', header: '', render: (i) => (
      Number(i.balanceDue) > 0 && i.status !== 'CANCELLED' ? <Button size="sm">Pay now</Button> : null
    ) },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Invoices" description={`${rows.length} invoices · pay outstanding balances online`} />
      <DataTable columns={columns} rows={rows} loading={isLoading} searchPlaceholder="Search invoice…" emptyTitle="No invoices" />
    </div>
  );
}
