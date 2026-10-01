'use client';

import { BarChart3, TrendingUp, Truck, Star } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, LineChart, Line, Legend } from 'recharts';
import { PageHeader, StatCard } from '@/components/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DataTable, type Column } from '@/components/data-table';
import { useAnalyticsOverview, useOnTimeRate, useFleetUtilization, useRevenueSeries, useDriverLeaderboard } from '@/lib/queries';
import { formatCurrency, formatPercent, formatNumber } from '@/lib/utils';

export default function AnalyticsPage() {
  const { data: ov } = useAnalyticsOverview();
  const { data: ontime } = useOnTimeRate();
  const { data: util } = useFleetUtilization();
  const { data: revenue } = useRevenueSeries();
  const { data: leaders } = useDriverLeaderboard();

  const revenueData: any[] = (revenue as any)?.series ?? (Array.isArray(revenue) ? revenue : []);
  const trend: any[] = (ontime as any)?.series ?? (ontime as any)?.trend ?? (Array.isArray(ontime) ? ontime : []);
  const drivers: any[] = (leaders as any)?.data ?? (Array.isArray(leaders) ? leaders : []);

  const columns: Column<any>[] = [
    { key: 'name', header: 'Driver', sortable: true, render: (d) => <span className="font-medium">{d.name ?? d.driverName}</span> },
    { key: 'deliveries', header: 'Deliveries', sortable: true, accessor: (d) => d.deliveries ?? d.total ?? 0, render: (d) => formatNumber(d.deliveries ?? d.total ?? 0) },
    { key: 'onTimeRate', header: 'On-time', accessor: (d) => Number(d.onTimeRate ?? 0), render: (d) => formatPercent(d.onTimeRate ?? 0) },
    { key: 'ratingAvg', header: 'Rating', sortable: true, accessor: (d) => Number(d.ratingAvg ?? 0), render: (d) => (
      <span className="inline-flex items-center gap-1"><Star className="h-3.5 w-3.5 fill-warning text-warning" />{formatNumber(d.ratingAvg ?? 0)}</span>
    ) },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Analytics" description="Operational and commercial performance." />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="On-Time Rate" value={formatPercent(ov?.onTimeRate ?? (ontime as any)?.rate)} icon={TrendingUp} />
        <StatCard title="Fleet Utilization" value={formatPercent(ov?.fleetUtilization ?? (util as any)?.rate)} icon={Truck} />
        <StatCard title="Revenue" value={formatCurrency(ov?.revenue, ov?.currency)} icon={BarChart3} />
        <StatCard title="Delivered" value={formatNumber(ov?.deliveredToday)} icon={TrendingUp} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Revenue by Period</CardTitle></CardHeader>
          <CardContent className="h-72">
            {revenueData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
                  <XAxis dataKey="label" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip /><Legend />
                  <Bar dataKey="value" fill="#2563eb" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No data yet.</div>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>On-Time Trend</CardTitle></CardHeader>
          <CardContent className="h-72">
            {trend.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trend}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
                  <XAxis dataKey="label" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis fontSize={12} tickLine={false} axisLine={false} domain={[0, 100]} />
                  <Tooltip /><Legend />
                  <Line type="monotone" dataKey="value" stroke="#16a34a" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No data yet.</div>}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Driver Leaderboard</CardTitle></CardHeader>
        <CardContent>
          <DataTable columns={columns} rows={drivers} searchPlaceholder="Search driver…" emptyTitle="No driver stats yet" />
        </CardContent>
      </Card>
    </div>
  );
}
