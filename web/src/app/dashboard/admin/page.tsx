'use client';

import { ShieldCheck, Building2, Users, TrendingUp, Package } from 'lucide-react';
import { PageHeader, StatCard } from '@/components/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DataTable, type Column } from '@/components/data-table';
import { Badge } from '@/components/ui/badge';
import { usePlatformStats, useAdminOrganizations } from '@/lib/queries';
import { formatNumber } from '@/lib/utils';

interface OrgRow {
  id: string;
  name: string;
  slug: string;
  subscriptionTier?: string;
  subscriptionStatus?: string;
  isActive?: boolean;
  _count?: { users?: number; vehicles?: number; orders?: number };
  city?: string | null;
  country?: string | null;
}

export default function PlatformAdminPage() {
  const { data: stats } = usePlatformStats();
  const { data: orgsData, isLoading } = useAdminOrganizations({ pageSize: 200 });
  const s = (stats as any) ?? {};
  const rows = (orgsData?.data ?? []) as OrgRow[];

  const columns: Column<OrgRow>[] = [
    { key: 'name', header: 'Organization', sortable: true, render: (o) => (
      <div><p className="font-medium">{o.name}</p><p className="text-xs text-muted-foreground">{o.slug}</p></div>
    ) },
    { key: 'tier', header: 'Plan', render: (o) => <Badge variant="secondary">{o.subscriptionTier ?? '—'}</Badge> },
    { key: 'subStatus', header: 'Status', render: (o) => (
      <Badge variant={o.subscriptionStatus === 'ACTIVE' ? 'success' : o.subscriptionStatus === 'PAST_DUE' ? 'destructive' : 'muted'}>{o.subscriptionStatus ?? '—'}</Badge>
    ) },
    { key: 'users', header: 'Users', accessor: (o) => o._count?.users ?? 0, render: (o) => formatNumber(o._count?.users ?? 0) },
    { key: 'vehicles', header: 'Vehicles', accessor: (o) => o._count?.vehicles ?? 0, render: (o) => formatNumber(o._count?.vehicles ?? 0) },
    { key: 'orders', header: 'Orders', accessor: (o) => o._count?.orders ?? 0, render: (o) => formatNumber(o._count?.orders ?? 0) },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Platform Admin" description="Cross-tenant operations (SUPER_ADMIN)." actions={<Badge variant="destructive"><ShieldCheck className="mr-1 h-3 w-3" />Restricted</Badge>} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Organizations" value={formatNumber(s.organizations ?? s.totalOrgs ?? rows.length)} icon={Building2} />
        <StatCard title="Total Users" value={formatNumber(s.users ?? s.totalUsers)} icon={Users} />
        <StatCard title="Active Subscriptions" value={formatNumber(s.activeSubscriptions ?? s.activeSubs)} icon={TrendingUp} />
        <StatCard title="Platform Orders" value={formatNumber(s.orders ?? s.totalOrders)} icon={Package} />
      </div>

      <Card>
        <CardHeader><CardTitle>Tenants</CardTitle></CardHeader>
        <CardContent>
          <DataTable columns={columns} rows={rows} loading={isLoading} searchPlaceholder="Search organization…" emptyTitle="No organizations" />
        </CardContent>
      </Card>
    </div>
  );
}
