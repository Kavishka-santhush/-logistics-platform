'use client';

import { ShieldCheck, AlertTriangle, Clock } from 'lucide-react';
import { PageHeader, StatCard } from '@/components/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DataTable, type Column } from '@/components/data-table';
import { StatusBadge } from '@/components/status-badge';
import { useComplianceStatus, resource } from '@/lib/queries';
import { humanize } from '@/lib/utils';
import type { ComplianceDoc } from '@/types';

const docsApi = resource<ComplianceDoc>('/compliance/documents');

function daysTo(dateStr?: string | null) {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86_400_000);
}

export default function CompliancePage() {
  const { data: status } = useComplianceStatus();
  const { data, isLoading } = docsApi.useList({ pageSize: 200 });
  const rows = (data?.data ?? []) as ComplianceDoc[];
  const s = (status as any) ?? {};
  const expiringSoon = rows.filter((r) => { const d = daysTo(r.expiryDate); return d !== null && d >= 0 && d <= 60; });
  const expired = rows.filter((r) => { const d = daysTo(r.expiryDate); return d !== null && d < 0; }) .concat(rows.filter((r) => r.status === 'EXPIRED'));

  const columns: Column<ComplianceDoc>[] = [
    { key: 'title', header: 'Document', sortable: true, render: (d) => <span className="font-medium">{d.title}</span> },
    { key: 'type', header: 'Type', render: (d) => humanize(d.type) },
    { key: 'subject', header: 'Subject', accessor: (d) => d.vehicleId ? 'vehicle' : d.driverId ? 'driver' : '', render: (d) => (d.vehicleId ? 'Vehicle' : d.driverId ? 'Driver' : 'Company') },
    { key: 'status', header: 'Status', render: (d) => <StatusBadge status={d.status} kind="document" /> },
    { key: 'expiryDate', header: 'Expiry', sortable: true, accessor: (d) => d.expiryDate ?? '', render: (d) => {
      const days = daysTo(d.expiryDate);
      if (days === null) return '—';
      return <span className={days < 0 ? 'text-destructive' : days <= 60 ? 'text-warning' : ''}>{new Date(d.expiryDate!).toLocaleDateString()} ({days < 0 ? `${-days}d over` : `${days}d`})</span>;
    } },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Compliance" description="Documents, certifications and expiries." />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard title="Approved" value={s.approved ?? rows.filter((r) => r.status === 'APPROVED').length} icon={ShieldCheck} />
        <StatCard title="Expiring ≤ 60d" value={expiringSoon.length} icon={Clock} />
        <StatCard title="Expired / Rejected" value={expired.length} icon={AlertTriangle} />
      </div>

      <DataTable columns={columns} rows={rows} loading={isLoading} searchPlaceholder="Search document…" emptyTitle="No compliance documents" />
    </div>
  );
}
