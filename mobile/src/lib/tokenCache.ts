import * as SecureStore from 'expo-secure-store';

/** Persist Clerk's session tokens in the device SecureStore (Keychain / Keystore). */
export const tokenCache = {
  async getToken(key: string): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
  },
  async setToken(key: string, value: string): Promise<void> {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch {
      /* no-op */
    }
  },
};
