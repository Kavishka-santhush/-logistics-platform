import { create } from 'zustand';
import type { Me } from '@/types';

/**
 * Global auth/session store. The Clerk token getter is injected by the auth
 * bridge; the server profile (`/auth/me`) is cached here for the whole app.
 */

interface AuthState {
  me: Me | null;
  loading: boolean;
  getToken: (() => Promise<string | null>) | null;
  setTokenGetter: (fn: (() => Promise<string | null>) | null) => void;
  setMe: (me: Me | null) => void;
  setLoading: (v: boolean) => void;
  clear: () => void;
  // derived helpers
  driverId: () => string | null;
  orgId: () => string | null;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  me: null,
  loading: true,
  getToken: null,
  setTokenGetter: (fn) => set({ getToken: fn }),
  setMe: (me) => set({ me, loading: false }),
  setLoading: (v) => set({ loading: v }),
  clear: () => set({ me: null, loading: false }),
  driverId: () => get().me?.driverProfile?.id ?? null,
  orgId: () => get().me?.organizationId ?? get().me?.organization?.id ?? null,
}));
