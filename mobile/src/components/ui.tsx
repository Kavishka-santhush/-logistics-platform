import React from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { theme, STATUS_COLORS } from '@/theme';

/* ── Screen container ───────────────────────────────────────────── */
export function Screen({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.screen, style]}>{children}</View>;
}

/* ── Card ───────────────────────────────────────────────────────── */
export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

/* ── Button ─────────────────────────────────────────────────────── */
export function Button({
  label,
  onPress,
  variant = 'primary',
  loading,
  disabled,
  style,
}: {
  label: string;
  onPress?: () => void;
  variant?: 'primary' | 'outline' | 'danger' | 'ghost';
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}) {
  const bg =
    variant === 'primary' ? theme.colors.primary
    : variant === 'danger' ? theme.colors.danger
    : 'transparent';
  const border = variant === 'outline' ? theme.colors.primary : 'transparent';
  const fg: TextStyle = {
    color: variant === 'primary' || variant === 'danger' ? '#fff' : theme.colors.primary,
  };
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: bg, borderColor: border, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={fg.color} /> : <Text style={[styles.btnText, fg]}>{label}</Text>}
    </Pressable>
  );
}

/* ── Status pill ────────────────────────────────────────────────── */
export function StatusPill({ status }: { status: string }) {
  const color = STATUS_COLORS[status] ?? theme.colors.muted;
  return (
    <View style={[styles.pillWrap, { backgroundColor: `${color}1A`, borderColor: color }]}>
      <Text style={[styles.pillText, { color }]}>{status.replace(/_/g, ' ')}</Text>
    </View>
  );
}

/* ── Field ──────────────────────────────────────────────────────── */
export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

/* ── Stat ───────────────────────────────────────────────────────── */
export function Stat({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={[styles.statValue, { color: color ?? theme.colors.text }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.bg, padding: 16 },
  card: { backgroundColor: theme.colors.card, borderRadius: theme.radius, padding: 16, borderWidth: 1, borderColor: theme.colors.border, marginBottom: 12 },
  btn: { height: 48, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  btnText: { fontSize: 16, fontWeight: '600' },
  pillWrap: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, borderWidth: 1, alignSelf: 'flex-start' },
  pillText: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  fieldLabel: { fontSize: 13, color: theme.colors.muted, marginBottom: 6, fontWeight: '600' },
  statValue: { fontSize: 22, fontWeight: '800' },
  statLabel: { fontSize: 12, color: theme.colors.muted, marginTop: 2 },
});
