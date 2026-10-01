import { create } from 'zustand';
import { api } from './api';
import type { Task } from '@/types';

/**
 * Driver task list + on-duty/tracking state. Kept in memory; refetched on
 * focus. Status transitions and POD updates go through the server.
 */

interface TasksState {
  tasks: Task[];
  loading: boolean;
  error: string | null;
  onDuty: boolean;
  loadTasks: (driverId: string) => Promise<void>;
  refreshTask: (id: string) => Promise<void>;
  updateStatus: (id: string, status: string, opts?: { note?: string; payload?: Record<string, any> }) => Promise<void>;
  setOnDuty: (v: boolean) => void;
}

export const useTasksStore = create<TasksState>((set, get) => ({
  tasks: [],
  loading: false,
  error: null,
  onDuty: false,

  async loadTasks(driverId) {
    set({ loading: true, error: null });
    try {
      const res = await api.get<{ data: Task[] }>('/orders/search', { driverId, pageSize: 100 });
      const list = Array.isArray(res) ? (res as unknown as Task[]) : res.data ?? [];
      set({ tasks: list, loading: false });
    } catch (e: any) {
      set({ error: e?.message ?? 'Failed to load tasks', loading: false });
    }
  },

  async refreshTask(id) {
    try {
      const task = await api.get<Task>(`/orders/${id}`);
      set({ tasks: get().tasks.map((t) => (t.id === id ? { ...t, ...task } : t)) });
    } catch {
      /* ignore — list refresh will recover */
    }
  },

  async updateStatus(id, status, opts) {
    // Optimistic update, then reconcile with the server response.
    const prev = get().tasks;
    set({ tasks: prev.map((t) => (t.id === id ? { ...t, status: status as any } : t)) });
    try {
      await api.post(`/orders/${id}/status`, { status, note: opts?.note, payload: opts?.payload });
      await get().refreshTask(id);
    } catch (e: any) {
      set({ tasks: prev });
      throw e;
    }
  },

  setOnDuty: (v) => set({ onDuty: v }),
}));
