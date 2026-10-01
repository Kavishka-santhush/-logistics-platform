'use client';

import { Package, Truck, Timer, TrendingUp, CircleDollarSign, AlertTriangle } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, Legend } from 'recharts';
import { PageHeader, StatCard } from '@/components/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAnalyticsOverview, useRevenueSeries, useOrderStatusBreakdown } from '@/lib/queries';
import { formatCurrency, formatNumber, formatPercent, humanize } from '@/lib/utils';

const COLORS = ['#2563eb', '#16a34a', '#f59e0b', '#dc2626', '#0ea5e9', '#8b5cf6', '#64748b', '#db2777'];

export default function DashboardPage() {
  const { data: ov, isLoading } = useAnalyticsOverview();
  const { data: revenue } = useRevenueSeries();
  const { data: breakdown } = useOrderStatusBreakdown();

  const revenueData: any[] = (revenue as any)?.series ?? (Array.isArray(revenue) ? revenue : []);
  const statusData: any[] = (breakdown as any)?.data ?? (Array.isArray(breakdown) ? breakdown : []);

  return (
    <div className="space-y-6">
      <PageHeader title="Operations Dashboard" description="Real-time overview of your fleet, deliveries and revenue." />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Active Orders" value={formatNumber(ov?.activeOrders)} icon={Package} loading={isLoading} hint={`${formatNumber(ov?.ordersTotal)} total`} />
        <StatCard title="On-Time Rate" value={formatPercent(ov?.onTimeRate)} icon={Timer} loading={isLoading} hint="Deliveries within SLA" />
        <StatCard title="Fleet Utilization" value={formatPercent(ov?.fleetUtilization)} icon={Truck} loading={isLoading} hint={`${ov?.vehiclesAvailable ?? 0}/${ov?.vehiclesTotal ?? 0} available`} />
        <StatCard title="Revenue" value={formatCurrency(ov?.revenue, ov?.currency)} icon={CircleDollarSign} loading={isLoading} hint="This period" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Revenue Trend</CardTitle></CardHeader>
          <CardContent className="h-72">
            {revenueData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueData}>
                  <defs>
                    <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
                  <XAxis dataKey="label" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip />
                  <Area type="monotone" dataKey="value" stroke="#2563eb" strokeWidth={2} fill="url(#rev)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No revenue data yet.</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Orders by Status</CardTitle></CardHeader>
          <CardContent className="h-72">
            {statusData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={statusData} dataKey="value" nameKey="label" cx="50%" cy="45%" outerRadius={70} label>
                    {statusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Legend />
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No orders yet.</div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Delivered Today" value={formatNumber(ov?.deliveredToday)} icon={TrendingUp} />
        <StatCard title="Failed Orders" value={formatNumber(ov?.failedOrders)} icon={AlertTriangle} />
        <StatCard title="Active Drivers" value={formatNumber(ov?.driversActive)} icon={Truck} />
        <StatCard title="Outstanding" value={formatCurrency(ov?.revenueOutstanding, ov?.currency)} icon={CircleDollarSign} hint="Unpaid invoices" />
      </div>
    </div>
  );
}
