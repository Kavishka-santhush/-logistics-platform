import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, StyleSheet, Pressable } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Screen, Card, StatusPill } from '@/components/ui';
import { useAuthStore } from '@/lib/authStore';
import { useTasksStore } from '@/lib/tasksStore';
import { theme } from '@/theme';
import { humanize, formatCurrency } from '@/lib/format';
import type { Task } from '@/types';

const FILTERS = ['All', 'Active', 'Delivered'] as const;

export default function TasksScreen() {
  const router = useRouter();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('All');
  const tasks = useTasksStore((s) => s.tasks);
  const loadTasks = useTasksStore((s) => s.loadTasks);
  const loading = useTasksStore((s) => s.loading);
  const driverId = useAuthStore((s) => s.driverId)();

  useFocusEffect(
    useCallback(() => {
      if (driverId) loadTasks(driverId);
    }, [driverId, loadTasks]),
  );

  function listFor(f: (typeof FILTERS)[number]): Task[] {
    if (f === 'Delivered') return tasks.filter((t) => t.status === 'DELIVERED');
    if (f === 'Active') return tasks.filter((t) => !['DELIVERED', 'CANCELLED', 'RETURNED', 'FAILED'].includes(t.status));
    return tasks;
  }

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.chips}>
        {FILTERS.map((f) => (
          <Pressable key={f} onPress={() => setFilter(f)} style={[styles.chip, filter === f && styles.chipActive]}>
            <Text style={[styles.chipText, filter === f && styles.chipTextActive]}>{f}</Text>
          </Pressable>
        ))}
      </View>
      <Screen style={{ paddingTop: 0 }}>
        <FlatList
          data={listFor(filter)}
          keyExtractor={(t) => t.id}
          refreshing={loading}
          onRefresh={() => driverId && loadTasks(driverId)}
          ListEmptyComponent={<Card><Text style={styles.empty}>No tasks assigned.</Text></Card>}
          renderItem={({ item }) => (
            <Pressable onPress={() => router.push(`/task/${item.id}`)}>
              <Card>
                <View style={styles.head}>
                  <Text style={styles.no}>{item.orderNumber}</Text>
                  <StatusPill status={item.status} />
                </View>
                <Text style={styles.route}>{item.pickupCity ?? '—'} → {item.deliveryCity ?? '—'}</Text>
                <Text style={styles.addr}>{item.deliveryAddressLine}</Text>
                <View style={styles.meta}>
                  <Text style={styles.metaText}>{humanize(item.type)}</Text>
                  {item.isCOD && <Text style={styles.cod}>COD {formatCurrency(item.codAmount, item.currency)}</Text>}
                </View>
              </Card>
            </Pressable>
          )}
        />
      </Screen>
    </View>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 10 },
  chip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999, backgroundColor: theme.colors.border },
  chipActive: { backgroundColor: theme.colors.primary },
  chipText: { fontSize: 13, fontWeight: '600', color: theme.colors.text },
  chipTextActive: { color: '#fff' },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  no: { fontSize: 15, fontWeight: '700', color: theme.colors.text },
  route: { fontSize: 14, color: theme.colors.text, fontWeight: '600' },
  addr: { fontSize: 13, color: theme.colors.muted, marginTop: 2 },
  meta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  metaText: { fontSize: 12, color: theme.colors.muted },
  cod: { fontSize: 12, color: theme.colors.warning, fontWeight: '700' },
  empty: { color: theme.colors.muted },
});
