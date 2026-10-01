import React, { useEffect } from 'react';
import { useAuth, useUser } from '@clerk/clerk-expo';
import { api, setTokenResolver, setOrgResolver } from '@/lib/api';
import { useAuthStore } from '@/lib/authStore';
import { connectSocket, disconnectSocket } from '@/lib/socket';
import type { Me } from '@/types';

/**
 * Bridges Clerk authentication into the app: injects a token + org resolver
 * into the API/socket clients, caches the server profile (/auth/me) and manages
 * the Socket.io connection lifecycle for the signed-in user.
 *
 * Renders nothing — it is a side-effect host mounted in the root layout.
 */
export function AuthBridge() {
  const { isSignedIn, getToken } = useAuth();
  const { isLoaded } = useUser();
  const setMe = useAuthStore((s) => s.setMe);
  const setLoading = useAuthStore((s) => s.setLoading);
  const clear = useAuthStore((s) => s.clear);

  // Provide the API client with Clerk-derived credentials.
  useEffect(() => {
    setTokenResolver(() => getToken());
    setOrgResolver(() => useAuthStore.getState().orgId());
  }, [getToken]);

  useEffect(() => {
    let active = true;
    async function bootstrap() {
      if (!isLoaded) return;
      if (!isSignedIn) {
        clear();
        disconnectSocket();
        return;
      }
      setLoading(true);
      try {
        const profile = await api.get<Me>('/auth/me');
        if (!active) return;
        setMe(profile);
        const token = await getToken();
        connectSocket(token);
      } catch {
        if (active) setLoading(false);
      }
    }
    bootstrap();
    return () => {
      active = false;
    };
  }, [isLoaded, isSignedIn, getToken, setMe, setLoading, clear]);

  return null;
}
