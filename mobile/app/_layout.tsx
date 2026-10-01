import 'react-native-url-polyfill/auto';
import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ClerkProvider, SignedIn, SignedOut, redirectToSignIn } from '@clerk/clerk-expo';
import { tokenCache } from '@/lib/tokenCache';
import { config } from '@/lib/config';
import { AuthBridge } from '@/components/AuthBridge';

const publishableKey = config.clerkPublishableKey;

export default function RootLayout() {
  // Without a publishable key Clerk cannot initialise; still render stack so
  // Metro/expo shows the app rather than crashing on an undefined key.
  if (!publishableKey) {
    return (
      <>
        <StatusBar style="auto" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)/login" />
        </Stack>
      </>
    );
  }

  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
      <StatusBar style="auto" />
      <AuthBridge />
      <SignedIn>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(app)" />
          <Stack.Screen
            name="task/[id]"
            options={{
              headerShown: true,
              title: 'Delivery task',
              headerTintColor: '#fff',
              headerStyle: { backgroundColor: '#2563eb' },
            }}
          />
        </Stack>
      </SignedIn>
      <SignedOut>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)/login" />
        </Stack>
      </SignedOut>
    </ClerkProvider>
  );
}

export { redirectToSignIn };
