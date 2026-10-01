import React, { useCallback, useEffect, useRef } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Screen, Card, Button, Stat, StatusPill } from '@/components/ui';
import { useAuthStore } from '@/lib/authStore';
import { useTasksStore } from '@/lib/tasksStore';
import { api } from '@/lib/api';
import { theme } from '@/theme';
import { formatCurrency } from '@/lib/format';
import { ensureLocationPermission, startTracking } from '@/lib/tracker';

export default function TodayScreen() {
  const me = useAuthStore((s) => s.me);
  const tasks = useTasksStore((s) => s.tasks);
  const loadTasks = useTasksStore((s) => s.loadTasks);
  const onDuty = useTasksStore((s) => s.onDuty);
  const setOnDuty = useTasksStore((s) => s.setOnDuty);
  const driverId = useAuthStore((s) => s.driverId)();
  const orgId = useAuthStore((s) => s.orgId)();
  const stopTrackingRef = useRef<(() => void) | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (driverId) loadTasks(driverId);
    }, [driverId, loadTasks]),
  );

  // While on duty, resolve the driver's vehicle and stream GPS fixes.
  useEffect(() => {
    if (!onDuty || !driverId) return;
    let cancelled = false;
    (async () => {
      try {
        const d = await api.get<{ vehicles?: { id: string }[]; assignedVehicleId?: string | null }>('/drivers/me');
        if (cancelled) return;
        const vehicleId = d.assignedVehicleId ?? d.vehicles?.[0]?.id;
        if (!vehicleId) return;
        stopTrackingRef.current = startTracking(vehicleId, orgId, driverId);
      } catch {
        /* tracking is best-effort; next shift retries */
      }
    })();
    return () => {
      cancelled = true;
      stopTrackingRef.current?.();
      stopTrackingRef.current = null;
    };
  }, [onDuty, driverId, orgId]);

  const active = tasks.filter((t) => !['DELIVERED', 'CANCELLED', 'RETURNED', 'FAILED'].includes(t.status));
  const delivered = tasks.filter((t) => t.status === 'DELIVERED');
  const codPending = tasks.filter((t) => t.isCOD && t.status !== 'DELIVERED');
  const next = active[0];

  async function toggleDuty() {
    if (!onDuty) {
      const ok = await ensureLocationPermission();
      setOnDuty(ok);
    } else {
      setOnDuty(false);
    }
  }

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={styles.hello}>Hi, {me?.driverProfile?.name ?? me?.firstName ?? 'Driver'} 👋</Text>
        <Text style={styles.sub}>{onDuty ? 'You are on duty — location is being shared.' : 'Go on duty to start sharing live location.'}</Text>

        <Card style={{ marginTop: 16 }}>
          <Button
            label={onDuty ? 'End shift' : 'Start shift'}
            variant={onDuty ? 'danger' : 'primary'}
            onPress={toggleDuty}
          />
        </Card>

        <View style={styles.statsRow}>
          <Card style={styles.statCard}>
            <View style={styles.statsInner}>
              <Stat label="Active" value={active.length} color={theme.colors.primary} />
              <Stat label="Delivered" value={delivered.length} color={theme.colors.success} />
              <Stat label="COD due" value={codPending.length} color={theme.colors.warning} />
            </View>
          </Card>
        </View>

        <Text style={styles.section}>Next stop</Text>
        {next ? (
          <Card>
            <View style={styles.nextHead}>
              <Text style={styles.orderNo}>{next.orderNumber}</Text>
              <StatusPill status={next.status} />
            </View>
            <Text style={styles.route}>{next.pickupCity ?? '—'} → {next.deliveryCity ?? '—'}</Text>
            <Text style={styles.addr}>{next.deliveryAddressLine}</Text>
            {next.promisedAt && <Text style={styles.promise}>Promised: {new Date(next.promisedAt).toLocaleString()}</Text>}
            {next.isCOD && <Text style={styles.cod}>COD: {formatCurrency(next.codAmount, next.currency)}</Text>}
          </Card>
        ) : (
          <Card><Text style={styles.empty}>No active tasks. Enjoy the quiet! 🎉</Text></Card>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hello: { fontSize: 24, fontWeight: '800', color: theme.colors.text },
  sub: { fontSize: 14, color: theme.colors.muted, marginTop: 4 },
  statsRow: { marginTop: 12 },
  statCard: { paddingVertical: 16 },
  statsInner: { flexDirection: 'row', gap: 12 },
  section: { fontSize: 16, fontWeight: '700', color: theme.colors.text, marginTop: 20, marginBottom: 8 },
  nextHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  orderNo: { fontSize: 16, fontWeight: '700', color: theme.colors.text },
  route: { fontSize: 14, color: theme.colors.text, fontWeight: '600' },
  addr: { fontSize: 13, color: theme.colors.muted, marginTop: 2 },
  promise: { fontSize: 12, color: theme.colors.muted, marginTop: 8 },
  cod: { fontSize: 13, color: theme.colors.warning, fontWeight: '700', marginTop: 6 },
  empty: { color: theme.colors.muted },
});
