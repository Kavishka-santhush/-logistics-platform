'use client';

import { useState } from 'react';
import { ReceiptText, Plus, Send } from 'lucide-react';
import { PageHeader } from '@/components/shared';
import { DataTable, type Column } from '@/components/data-table';
import { StatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { invoicesApi } from '@/lib/queries';
import { formatCurrency } from '@/lib/utils';
import type { Invoice } from '@/types';

export default function InvoicesPage() {
  const [status, setStatus] = useState('');
  const { data, isLoading } = invoicesApi.useList({ pageSize: 200, status: status || undefined });
  const { data: aging } = invoicesApi.useAging();
  const send = invoicesApi.useSend();
  const rows = (data?.data ?? []) as Invoice[];
  const agingBuckets: any[] = (aging as any)?.buckets ?? (Array.isArray(aging) ? aging : []);

  const columns: Column<Invoice>[] = [
    { key: 'number', header: 'Invoice', sortable: true, render: (i) => <span className="font-medium">{i.number}</span> },
    { key: 'customer', header: 'Customer', accessor: (i) => i.customer?.companyName ?? '', render: (i) => i.customer?.companyName || '—' },
    { key: 'status', header: 'Status', render: (i) => <StatusBadge status={i.status} kind="invoice" /> },
    { key: 'issueDate', header: 'Issued', sortable: true, accessor: (i) => i.issueDate, render: (i) => new Date(i.issueDate).toLocaleDateString() },
    { key: 'dueDate', header: 'Due', sortable: true, accessor: (i) => i.dueDate, render: (i) => (
      <span className={i.status === 'OVERDUE' ? 'text-destructive' : ''}>{new Date(i.dueDate).toLocaleDateString()}</span>
    ) },
    { key: 'totalAmount', header: 'Total', sortable: true, accessor: (i) => Number(i.totalAmount), render: (i) => formatCurrency(i.totalAmount, i.currency) },
    { key: 'balanceDue', header: 'Balance', accessor: (i) => Number(i.balanceDue), render: (i) => formatCurrency(i.balanceDue, i.currency) },
    { key: 'actions', header: '', render: (i) => (
      i.status === 'DRAFT' ? (
        <Button size="sm" variant="outline" onClick={() => send.mutate(i.id)} disabled={send.isPending}><Send className="mr-1 h-3.5 w-3.5" />Send</Button>
      ) : null
    ) },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Invoices" description={`${rows.length} invoices`} actions={<Button><Plus className="h-4 w-4" /> New Invoice</Button>} />

      {agingBuckets.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Receivables Aging</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-5">
            {agingBuckets.map((b, i) => (
              <div key={i} className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">{b.label ?? b.bucket ?? `Bucket ${i}`}</p>
                <p className="mt-1 text-lg font-bold">{formatCurrency(b.amount ?? b.total, 'EUR')}</p>
                <p className="text-xs text-muted-foreground">{b.count ?? 0} invoices</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <DataTable
        columns={columns}
        rows={rows}
        loading={isLoading}
        searchPlaceholder="Search invoice number or customer…"
        emptyTitle="No invoices"
        toolbar={
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="flex h-9 w-44 rounded-md border border-input bg-transparent px-3 text-sm">
            <option value="">All statuses</option>
            {['DRAFT', 'SENT', 'PAID', 'PARTIALLY_PAID', 'OVERDUE', 'CANCELLED'].map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
          </select>
        }
      />
    </div>
  );
}
