import React from 'react';
import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { theme } from '@/theme';

/* Simple glyph "icons" to avoid pulling in an icon dependency. */
function Glyph({ label }: { label: string }) {
  return <Text style={{ fontSize: 18, color: theme.colors.muted }}>{label}</Text>;
}

export default function AppTabs() {
  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerTitleStyle: { fontWeight: '700', color: theme.colors.text },
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.muted,
        tabBarStyle: { backgroundColor: theme.colors.card, borderTopColor: theme.colors.border },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Today', tabBarIcon: () => <Glyph label="🗓" /> }} />
      <Tabs.Screen name="tasks" options={{ title: 'Tasks', tabBarIcon: () => <Glyph label="📦" /> }} />
      <Tabs.Screen name="messages" options={{ title: 'Messages', tabBarIcon: () => <Glyph label="💬" /> }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: () => <Glyph label="👤" /> }} />
    </Tabs>
  );
}
