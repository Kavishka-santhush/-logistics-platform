import Constants from 'expo-constants';

/**
 * Runtime configuration. Values come from EXPO_PUBLIC_* env vars when present,
 * otherwise fall back to app.json `extra` so the app still boots in dev builds.
 */
const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, string>;

export const config = {
  apiUrl: process.env.EXPO_PUBLIC_API_URL ?? extra.apiUrl ?? 'http://localhost:5000/api',
  socketUrl: process.env.EXPO_PUBLIC_SOCKET_URL ?? extra.socketUrl ?? 'http://localhost:5000',
  clerkPublishableKey: process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? extra.clerkPublishableKey ?? '',
};
