'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AppState {
  /** Active organization id (multi-org users can switch). */
  organizationId: string | null;
  setOrganizationId: (id: string | null) => void;
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      organizationId: null,
      setOrganizationId: (id) => set({ organizationId: id }),
      sidebarCollapsed: false,
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
    }),
    { name: 'swiftfreight-app-state' }
  )
);
