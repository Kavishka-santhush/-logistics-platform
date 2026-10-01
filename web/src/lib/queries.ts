'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Paginated } from '@/types';

/**
 * Typed query/mutation hooks. Endpoints mirror the Express routers:
 *   /api/vehicles /api/drivers /api/orders /api/dispatch /api/tracking
 *   /api/customers /api/invoices /api/analytics /api/fleet /api/maintenance
 *   /api/fuel /api/compliance /api/warehouse(s) /api/inventory /api/notifications
 *   /api/ai /api/reports /api/admin /api/organizations /api/routes
 */

type QueryParams = Record<string, string | number | boolean | undefined | null>;
const clean = (p?: QueryParams) => {
  if (!p) return undefined;
  return Object.fromEntries(Object.entries(p).filter(([, v]) => v !== undefined && v !== null && v !== ''));
};

// ─── generic CRUD factory ─────────────────────────────────────────────────────
export function resource<T>(base: string) {
  return {
    listKey: (params?: QueryParams) => [base, 'list', clean(params)],
    useList: (params?: QueryParams) =>
      useQuery<Paginated<T>>({
        queryKey: [base, 'list', clean(params)],
        queryFn: () => api.get(base, clean(params)),
      }),
    useOne: (id?: string | null) =>
      useQuery<T>({
        queryKey: [base, id],
        queryFn: () => api.get(`${base}/${id}`),
        enabled: Boolean(id),
      }),
    useCreate: () => {
      const qc = useQueryClient();
      return useMutation({ mutationFn: (body: object) => api.post(base, body), onSuccess: () => qc.invalidateQueries({ queryKey: [base] }) });
    },
    useUpdate: () => {
      const qc = useQueryClient();
      return useMutation({ mutationFn: ({ id, ...body }: { id: string } & object) => api.put(`${base}/${id}`, body), onSuccess: () => qc.invalidateQueries({ queryKey: [base] }) });
    },
    useRemove: () => {
      const qc = useQueryClient();
      return useMutation({ mutationFn: (id: string) => api.delete(`${base}/${id}`), onSuccess: () => qc.invalidateQueries({ queryKey: [base] }) });
    },
  };
}

// ─── domain resources ─────────────────────────────────────────────────────────
export const vehiclesApi = resource('/vehicles');
export const driversApi = resource('/drivers');
export const customersApi = resource('/customers');
export const warehousesApi = resource('/warehouses');
export const inventoryApi = resource('/inventory');

export const ordersApi = {
  ...resource('/orders'),
  useUpdateStatus: () => {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: ({ id, status, note }: { id: string; status: string; note?: string }) => api.post(`/orders/${id}/status`, { status, note }),
      onSuccess: () => qc.invalidateQueries({ queryKey: ['/orders'] }),
    });
  },
  useClone: () => {
    const qc = useQueryClient();
    return useMutation({ mutationFn: (id: string) => api.post(`/orders/${id}/clone`), onSuccess: () => qc.invalidateQueries({ queryKey: ['/orders'] }) });
  },
};

export const invoicesApi = {
  ...resource('/invoices'),
  useSend: () => {
    const qc = useQueryClient();
    return useMutation({ mutationFn: (id: string) => api.post(`/invoices/${id}/send`), onSuccess: () => qc.invalidateQueries({ queryKey: ['/invoices'] }) });
  },
  useRecordPayment: () => {
    const qc = useQueryClient();
    return useMutation({ mutationFn: ({ id, ...body }: { id: string } & object) => api.post(`/invoices/${id}/payments`, body), onSuccess: () => qc.invalidateQueries({ queryKey: ['/invoices'] }) });
  },
  useAging: () => useQuery({ queryKey: ['/invoices', 'aging'], queryFn: () => api.get('/invoices/aging') }),
};

// ─── analytics ────────────────────────────────────────────────────────────────
export const analyticsKeys = { all: ['analytics'] as const };

export function useAnalyticsOverview() {
  return useQuery({ queryKey: ['analytics', 'overview'], queryFn: () => api.get('/analytics/overview'), refetchInterval: 60_000 });
}
export function useOnTimeRate(params?: QueryParams) {
  return useQuery({ queryKey: ['analytics', 'ontime', clean(params)], queryFn: () => api.get('/analytics/on-time-rate', clean(params)) });
}
export function useFleetUtilization() {
  return useQuery({ queryKey: ['analytics', 'utilization'], queryFn: () => api.get('/analytics/fleet-utilization') });
}
export function useRevenueSeries(params?: QueryParams) {
  return useQuery({ queryKey: ['analytics', 'revenue', clean(params)], queryFn: () => api.get('/analytics/revenue', clean(params)) });
}
export function useDriverLeaderboard() {
  return useQuery({ queryKey: ['analytics', 'drivers'], queryFn: () => api.get('/analytics/driver-leaderboard') });
}
export function useOrderStatusBreakdown() {
  return useQuery({ queryKey: ['analytics', 'status-breakdown'], queryFn: () => api.get('/analytics/order-status-breakdown') });
}

// ─── live tracking ──────────────────────────────────────────────────────────
export function useLiveVehicles() {
  return useQuery({ queryKey: ['tracking', 'live'], queryFn: () => api.get('/tracking/live'), refetchInterval: 15_000 });
}
export function useVehicleTrail(vehicleId?: string) {
  return useQuery({ queryKey: ['tracking', 'trail', vehicleId], queryFn: () => api.get(`/tracking/vehicle/${vehicleId}`), enabled: Boolean(vehicleId) });
}
export function usePublicTracking(trackingNumber: string) {
  return useQuery({ queryKey: ['tracking', 'public', trackingNumber], queryFn: () => api.get(`/tracking/public/${trackingNumber}`), enabled: Boolean(trackingNumber) });
}

// ─── dispatch board ─────────────────────────────────────────────────────────
export function useDispatchBoard(date?: string) {
  return useQuery({ queryKey: ['dispatch', 'board', date], queryFn: () => api.get('/dispatch/board', { date }) });
}
export function useAssignDispatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { driverId: string; vehicleId?: string; orderId?: string; routeId?: string; mode?: string }) => api.post('/dispatch', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dispatch'] });
      qc.invalidateQueries({ queryKey: ['/orders'] });
    },
  });
}

// ─── fleet / vehicle ops ────────────────────────────────────────────────────
export function useFleetSummary() {
  return useQuery({ queryKey: ['fleet', 'summary'], queryFn: () => api.get('/fleet/summary') });
}
export function useUpdateVehicleStatus() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ id, status }: { id: string; status: string }) => api.patch(`/vehicles/${id}/status`, { status }), onSuccess: () => qc.invalidateQueries({ queryKey: ['/vehicles'] }) });
}

// ─── maintenance & compliance ───────────────────────────────────────────────
export function useMaintenanceDue() {
  return useQuery({ queryKey: ['maintenance', 'due'], queryFn: () => api.get('/maintenance/due') });
}
export function useComplianceStatus() {
  return useQuery({ queryKey: ['compliance', 'status'], queryFn: () => api.get('/compliance/status') });
}

// ─── notifications ──────────────────────────────────────────────────────────
export function useNotifications() {
  return useQuery({ queryKey: ['notifications'], queryFn: () => api.get('/notifications') });
}
export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => api.patch(`/notifications/${id}/read`), onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }) });
}

// ─── AI ───────────────────────────────────────────────────────────────────────
export function useAskFleetAssistant() {
  return useMutation({ mutationFn: (body: { question: string }) => api.post('/ai/chatbot', body) });
}
export function useDemandForecast() {
  return useQuery({ queryKey: ['ai', 'demand-forecast'], queryFn: () => api.get('/ai/demand-forecast') });
}
export function useOptimizeRoute() {
  return useMutation({ mutationFn: (body: { stops: unknown[]; vehicleId?: string }) => api.post('/ai/route-optimize', body) });
}

// ─── admin (SUPER_ADMIN) ──────────────────────────────────────────────────────
export function usePlatformStats() {
  return useQuery({ queryKey: ['admin', 'stats'], queryFn: () => api.get('/admin/stats') });
}
export function useAdminOrganizations(params?: QueryParams) {
  return useQuery({ queryKey: ['admin', 'orgs', clean(params)], queryFn: () => api.get('/admin/organizations', clean(params)) });
}
