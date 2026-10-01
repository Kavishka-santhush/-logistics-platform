'use client';

import { useMemo, useEffect } from 'react';
import { ClerkProvider, useAuth } from '@clerk/nextjs';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { setTokenResolver, setOrgResolver } from '@/lib/api';
import { connectSocket, disconnectSocket } from '@/lib/socket';
import { useAppStore } from '@/lib/store';

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: 1,
        refetchOnWindowFocus: false,
      },
    },
  });
}

/** Wires the Clerk session token + active org into the HTTP client and socket. */
function AuthBridge() {
  const { getToken, userId } = useAuth();
  const organizationId = useAppStore((s) => s.organizationId);

  useEffect(() => {
    setTokenResolver(async () => {
      try {
        return await getToken({ template: 'swiftfreight' });
      } catch {
        return null;
      }
    });
    setOrgResolver(() => useAppStore.getState().organizationId);
  }, [getToken]);

  // Authenticate the socket whenever the session or org changes.
  useEffect(() => {
    if (!userId) {
      disconnectSocket();
      return;
    }
    let cancelled = false;
    (async () => {
      const token = await getToken({ template: 'swiftfreight' }).catch(() => null);
      if (!cancelled) connectSocket(token);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, organizationId, getToken]);

  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const queryClient = useMemo(makeQueryClient, []);
  return (
    <ClerkProvider>
      <QueryClientProvider client={queryClient}>
        <AuthBridge />
        {children}
      </QueryClientProvider>
    </ClerkProvider>
  );
}
