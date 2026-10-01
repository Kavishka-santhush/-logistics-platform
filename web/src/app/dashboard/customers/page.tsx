'use client';

import { Plus, Star } from 'lucide-react';
import { PageHeader } from '@/components/shared';
import { DataTable, type Column } from '@/components/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { customersApi } from '@/lib/queries';
import { formatCurrency, formatNumber } from '@/lib/utils';
import type { Customer } from '@/types';

const TIER: Record<string, 'default' | 'info' | 'warning' | 'success'> = {
  STANDARD: 'muted' as any, SILVER: 'info', GOLD: 'warning', PLATINUM: 'success',
};

export default function CustomersPage() {
  const { data, isLoading } = customersApi.useList({ pageSize: 200 });
  const rows = (data?.data ?? []) as Customer[];

  const columns: Column<Customer>[] = [
    { key: 'companyName', header: 'Company', sortable: true, render: (c) => (
      <div><p className="font-medium">{c.companyName}</p>{c.contactName && <p className="text-xs text-muted-foreground">{c.contactName}</p>}</div>
    ) },
    { key: 'email', header: 'Email', render: (c) => c.email || '—' },
    { key: 'phone', header: 'Phone', render: (c) => c.phone || '—' },
    { key: 'tier', header: 'Tier', render: (c) => <Badge variant={(TIER[c.tier] ?? 'secondary') as any}>{c.tier}</Badge> },
    { key: 'slaHours', header: 'SLA', accessor: (c) => c.slaHours ?? 0, render: (c) => (c.slaHours ? `${c.slaHours}h` : '—') },
    { key: 'creditLimit', header: 'Credit', accessor: (c) => Number(c.creditLimit ?? 0), render: (c) => (c.creditLimit ? formatCurrency(c.creditLimit) : '—') },
    { key: 'paymentTerms', header: 'Terms', render: (c) => c.paymentTerms || '—' },
    { key: 'ratingAvg', header: 'Rating', sortable: true, accessor: (c) => Number(c.ratingAvg), render: (c) => (
      <span className="inline-flex items-center gap-1"><Star className="h-3.5 w-3.5 fill-warning text-warning" />{formatNumber(c.ratingAvg)}</span>
    ) },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Customers" description={`${rows.length} customer accounts`} actions={<Button><Plus className="h-4 w-4" /> Add Customer</Button>} />
      <DataTable columns={columns} rows={rows} loading={isLoading} searchPlaceholder="Search company or contact…" emptyTitle="No customers yet" />
    </div>
  );
}
