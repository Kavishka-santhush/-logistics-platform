import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useAuth } from '@clerk/clerk-expo';
import { Screen, Card, Button, Stat, StatusPill } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/authStore';
import { disconnectSocket } from '@/lib/socket';
import { theme } from '@/theme';
import { formatNumber } from '@/lib/format';
import type { DriverFull, PerformanceSummary } from '@/types';

export default function ProfileScreen() {
  const me = useAuthStore((s) => s.me);
  const driverId = useAuthStore((s) => s.driverId)();
  const clear = useAuthStore((s) => s.clear);
  const { signOut } = useAuth();

  const [driver, setDriver] = useState<DriverFull | null>(null);
  const [perf, setPerf] = useState<PerformanceSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!driverId) return;
    try {
      const [d, p] = await Promise.all([
        api.get<DriverFull>('/drivers/me'),
        api.get<PerformanceSummary>(`/drivers/${driverId}/performance`).catch(() => null),
      ]);
      setDriver(d);
      if (p) setPerf(p);
    } catch (e: any) {
      Alert.alert('Could not load profile', e?.message ?? 'Please retry.');
    } finally {
      setLoading(false);
    }
  }, [driverId]);

  useEffect(() => {
    load();
  }, [load]);

  // Register the Expo push token so the server can send mobile notifications.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!driverId) return;
      try {
        const { status } = await Notifications.getPermissionsAsync();
        let finalStatus = status;
        if (finalStatus !== 'granted') {
          const req = await Notifications.requestPermissionsAsync();
          finalStatus = req.status;
        }
        if (finalStatus !== 'granted' || cancelled) return;
        const token = (await Notifications.getExpoPushTokenAsync()).data;
        if (token) await api.post('/auth/push-token', { token });
      } catch {
        /* push registration is best-effort */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [driverId]);

  async function onSignOut() {
    Alert.alert('Sign out', 'End your session on this device?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          disconnectSocket();
          clear();
          try {
            await signOut({ redirectUrl: '/' as any });
          } catch {
            /* Clerk handles the redirect */
          }
        },
      },
    ]);
  }

  if (loading) {
    return (
      <Screen style={{ alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </Screen>
    );
  }

  const hosMinutes = driver?.todayDrivingMinutes ?? 0;
  const hosLimitMin = Number(driver?.hoursLimitDaily ?? 0) * 60;
  const hosPct = hosLimitMin ? Math.min(100, Math.round((hosMinutes / hosLimitMin) * 100)) : 0;

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Card>
          <View style={styles.head}>
            <Text style={styles.name}>{driver?.name ?? me?.driverProfile?.name ?? 'Driver'}</Text>
            {driver?.status && <StatusPill status={driver.status} />}
          </View>
          <Text style={styles.meta}>{driver?.employeeId ?? me?.driverProfile?.employeeId ?? ''}</Text>
          {!!driver?.phone && <Text style={styles.meta}>{driver.phone}</Text>}
          {driver?.branch?.name && <Text style={styles.meta}>{driver.branch.name}</Text>}
        </Card>

        <Text style={styles.section}>Performance (90 days)</Text>
        <Card>
          <View style={styles.statsInner}>
            <Stat label="On-time" value={`${formatNumber(perf?.onTimeRate ?? driver?.onTimeRate ?? 0)}%`} color={theme.colors.primary} />
            <Stat label="Success" value={`${formatNumber(perf?.successRate ?? driver?.successRate ?? 0)}%`} color={theme.colors.success} />
            <Stat label="Score" value={formatNumber(perf?.score ?? driver?.performanceScore ?? 0)} color={theme.colors.info} />
          </View>
          <View style={{ height: 10 }} />
          <View style={styles.statsInner}>
            <Stat label="Avg rating" value={formatNumber(perf?.avgRating ?? driver?.ratingAvg ?? 0)} />
            <Stat label="Violations" value={formatNumber(perf?.violations ?? 0)} color={theme.colors.warning} />
          </View>
        </Card>

        <Text style={styles.section}>Hours of service — today</Text>
        <Card>
          <View style={styles.hosRow}>
            <Text style={styles.hosText}>{Math.floor(hosMinutes / 60)}h {hosMinutes % 60}m driven</Text>
            <Text style={styles.hosLimit}>{Math.round(hosLimitMin / 60)}h limit</Text>
          </View>
          <View style={styles.barTrack}>
            <View
              style={[
                styles.barFill,
                { width: `${hosPct}%`, backgroundColor: hosPct >= 90 ? theme.colors.danger : theme.colors.primary },
              ]}
            />
          </View>
          {hosPct >= 90 && <Text style={styles.hosWarn}>Approaching your daily driving limit.</Text>}
        </Card>

        {driver?.licenseExpiryDate && (
          <Card>
            <Text style={styles.meta}>License expires: {new Date(driver.licenseExpiryDate).toLocaleDateString()}</Text>
          </Card>
        )}

        <Button label="Sign out" variant="danger" onPress={onSignOut} style={{ marginTop: 12 }} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  name: { fontSize: 20, fontWeight: '800', color: theme.colors.text },
  meta: { fontSize: 13, color: theme.colors.muted, marginTop: 4 },
  section: { fontSize: 16, fontWeight: '700', color: theme.colors.text, marginTop: 20, marginBottom: 8 },
  statsInner: { flexDirection: 'row', gap: 24 },
  hosRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  hosText: { fontSize: 14, fontWeight: '700', color: theme.colors.text },
  hosLimit: { fontSize: 13, color: theme.colors.muted },
  barTrack: { height: 8, borderRadius: 4, backgroundColor: theme.colors.border, overflow: 'hidden' },
  barFill: { height: 8, borderRadius: 4 },
  hosWarn: { fontSize: 12, color: theme.colors.danger, marginTop: 8, fontWeight: '600' },
});
