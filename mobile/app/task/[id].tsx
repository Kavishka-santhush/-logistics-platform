import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Linking,
  TextInput,
  Image,
  Modal,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Screen, Card, Button, StatusPill, Field } from '@/components/ui';
import { api, assetUrl } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { useAuthStore } from '@/lib/authStore';
import { useTasksStore } from '@/lib/tasksStore';
import { pickPodPhotos, captureAndRecordPod } from '@/lib/pod';
import { formatCurrency, humanize, timeAgo } from '@/lib/format';
import { theme } from '@/theme';
import type { OrderDetail } from '@/types';

const FAILED_REASONS = [
  'RECIPIENT_ABSENT',
  'ADDRESS_NOT_FOUND',
  'REFUSED_DELIVERY',
  'DAMAGED_GOODS',
  'ROAD_BLOCKED',
  'OTHER',
];

/** Next sensible status transitions for a driver on the road. */
function nextActions(status: string): { status: string; label: string; variant: 'primary' | 'outline' | 'danger' }[] {
  if (status === 'DELIVERED' || status === 'CANCELLED' || status === 'RETURNED') return [];
  const acts: { status: string; label: string; variant: 'primary' | 'outline' | 'danger' }[] = [];
  if (status === 'CONFIRMED' || status === 'ASSIGNED') acts.push({ status: 'PICKED_UP', label: 'Mark picked up', variant: 'primary' });
  if (status === 'PICKED_UP') acts.push({ status: 'IN_TRANSIT', label: 'Start trip', variant: 'primary' });
  if (['PICKED_UP', 'IN_TRANSIT'].includes(status)) acts.push({ status: 'OUT_FOR_DELIVERY', label: 'Out for delivery', variant: 'primary' });
  if (['ASSIGNED', 'PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY'].includes(status)) {
    acts.push({ status: 'DELIVERED', label: 'Deliver (capture POD)', variant: 'primary' });
    acts.push({ status: 'FAILED', label: 'Report failure', variant: 'danger' });
  }
  return acts;
}

export default function TaskDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [podOpen, setPodOpen] = useState(false);
  const [podAssets, setPodAssets] = useState<any[]>([]);
  const [capturedName, setCapturedName] = useState('');
  const [codCollected, setCodCollected] = useState('');
  const [failOpen, setFailOpen] = useState(false);
  const [failReason, setFailReason] = useState(FAILED_REASONS[0]);
  const [failNote, setFailNote] = useState('');

  const refreshTask = useTasksStore((s) => s.refreshTask);
  const updateStatus = useTasksStore((s) => s.updateStatus);
  const driverId = useAuthStore((s) => s.driverId)();

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setError(null);
      const o = await api.get<OrderDetail>(`/orders/${id}`);
      setOrder(o);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load task');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const actions = useMemo(() => (order ? nextActions(order.status) : []), [order]);

  async function runTransition(next: string) {
    if (!order) return;
    if (next === 'DELIVERED') {
      setPodAssets([]);
      setCapturedName(order.deliveryContactName ?? '');
      setCodCollected(order.isCOD ? String(order.codAmount ?? '') : '');
      setPodOpen(true);
      return;
    }
    if (next === 'FAILED') {
      setFailOpen(true);
      return;
    }
    setBusy(next);
    try {
      await updateStatus(order.id, next);
      await load();
    } catch (e: any) {
      Alert.alert('Could not update', e?.message ?? 'Please retry.');
    } finally {
      setBusy(null);
    }
  }

  async function choosePhotos() {
    try {
      const assets = await pickPodPhotos(4);
      if (assets.length) setPodAssets((prev) => [...prev, ...assets].slice(0, 4));
    } catch (e: any) {
      Alert.alert('Camera unavailable', e?.message ?? 'Please retry.');
    }
  }

  async function confirmDelivery() {
    if (!order) return;
    if (!podAssets.length) {
      Alert.alert('Photos required', 'Capture at least one proof-of-delivery photo.');
      return;
    }
    setBusy('DELIVERED');
    try {
      const loc = await getCurrentCoords();
      await captureAndRecordPod(order.id, podAssets, {
        capturedName: capturedName || undefined,
        latitude: loc?.latitude,
        longitude: loc?.longitude,
        codCollected: order.isCOD ? Number(codCollected || 0) : undefined,
        scannedBarcodes: order.packages?.map((p) => p.barcode),
        metadata: { capturedVia: 'driver-app', driverId },
      });
      await api.post(`/orders/${order.id}/status`, { status: 'DELIVERED', note: 'Delivered via driver app' });
      setPodOpen(false);
      await load();
      await refreshTask(order.id);
    } catch (e: any) {
      Alert.alert('Delivery not recorded', e?.message ?? 'Please retry.');
    } finally {
      setBusy(null);
    }
  }

  async function submitFailure() {
    if (!order) return;
    setBusy('FAILED');
    try {
      await updateStatus(order.id, 'FAILED', {
        note: failNote || undefined,
        payload: { failedReason: failReason, failedNote: failNote || undefined },
      });
      setFailOpen(false);
      await load();
    } catch (e: any) {
      Alert.alert('Could not report failure', e?.message ?? 'Please retry.');
    } finally {
      setBusy(null);
    }
  }

  function openNavigation() {
    if (!order) return;
    const lat = Number(order.deliveryLatitude ?? '');
    const lng = Number(order.deliveryLongitude ?? '');
    const dest = Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0
      ? `${lat},${lng}`
      : encodeURIComponent(order.deliveryAddressLine ?? '');
    Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${dest}`);
  }

  function callContact() {
    const phone = order?.deliveryContactPhone ?? order?.contactPhone;
    if (!phone) return Alert.alert('No phone number', 'This stop has no contact number.');
    Linking.openURL(`tel:${phone}`);
  }

  function sendSos() {
    Alert.alert('Send emergency SOS?', 'Your dispatcher will be alerted with your last position.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Send SOS',
        style: 'destructive',
        onPress: async () => {
          const loc = await getCurrentCoords();
          getSocket().emit('driver:sos', {
            lat: loc?.latitude,
            lng: loc?.longitude,
            orderId: order?.id,
            locationText: order?.deliveryAddressLine,
          });
          Alert.alert('SOS sent', 'Help has been notified.');
        },
      },
    ]);
  }

  if (loading) {
    return (
      <Screen>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </Screen>
    );
  }

  if (!order) {
    return (
      <Screen>
        <Card>
          <Text style={styles.errorText}>{error ?? 'Task not found.'}</Text>
          <Button label="Retry" variant="outline" onPress={load} />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <Card>
          <View style={styles.row}>
            <Text style={styles.orderNo}>{order.orderNumber}</Text>
            <StatusPill status={order.status} />
          </View>
          <Text style={styles.tracking}>#{order.trackingNumber}</Text>
          <View style={styles.chipsRow}>
            <Text style={styles.chip}>{humanize(order.type)}</Text>
            <Text style={styles.chip}>{humanize(order.priority)} priority</Text>
            {order.isCOD && <Text style={[styles.chip, { color: theme.colors.warning }]}>COD</Text>}
          </View>
        </Card>

        <Card>
          <Text style={styles.sectionTitle}>Delivery</Text>
          <Text style={styles.addr}>{order.deliveryAddressLine}</Text>
          {!!order.deliveryCity && <Text style={styles.sub}>{order.deliveryCity}</Text>}
          <Text style={styles.sub}>
            {order.deliveryContactName ?? 'Recipient'} · {order.deliveryContactPhone ?? order.contactPhone ?? 'no phone'}
          </Text>
          {(order.deliveryWindowStart || order.promisedAt) && (
            <Text style={styles.sub}>
              Window {order.deliveryWindowStart ?? '—'}–{order.deliveryWindowEnd ?? '—'}
              {order.promisedAt ? ` · SLA ${new Date(order.promisedAt).toLocaleString()}` : ''}
            </Text>
          )}
          {!!order.specialInstructions && <Text style={styles.note}>⚠ {order.specialInstructions}</Text>}
          <View style={styles.btnRow}>
            <Button label="Navigate" onPress={openNavigation} style={styles.flexBtn} />
            <Button label="Call" variant="outline" onPress={callContact} style={styles.flexBtn} />
          </View>
        </Card>

        <Card>
          <Text style={styles.sectionTitle}>Cargo</Text>
          <Text style={styles.sub}>{order.packages?.length ?? 0} package(s) · {order.totalWeightKg} kg</Text>
          {(order.packages ?? []).map((p) => (
            <Text key={p.id} style={styles.barcode}>{p.barcode} · {humanize(p.type)}</Text>
          ))}
          {order.isCOD && (
            <Text style={styles.cod}>Collect {formatCurrency(order.codAmount, order.currency)} on delivery</Text>
          )}
        </Card>

        <Card>
          <Text style={styles.sectionTitle}>Assignment</Text>
          <Text style={styles.sub}>Driver: {order.assignedDriver?.name ?? '—'}</Text>
          <Text style={styles.sub}>Vehicle: {order.assignedVehicle?.plateNumber ?? '—'}</Text>
          {order.pickupAddressLine && <Text style={styles.sub}>Pickup: {order.pickupAddressLine}</Text>}
        </Card>

        {actions.length > 0 && (
          <Card>
            <Text style={styles.sectionTitle}>Actions</Text>
            {actions.map((a) => (
              <Button
                key={a.status}
                label={a.label}
                variant={a.variant}
                loading={busy === a.status}
                disabled={!!busy && busy !== a.status}
                onPress={() => runTransition(a.status)}
                style={{ marginBottom: 10 }}
              />
            ))}
            <Button label="Emergency SOS" variant="ghost" onPress={sendSos} style={{ borderColor: theme.colors.danger }} />
          </Card>
        )}

        {(order.proofs?.length ?? 0) > 0 && (
          <Card>
            <Text style={styles.sectionTitle}>Proof of delivery</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {order.proofs!.map((pr) => {
                const src = assetUrl(pr.fileUrl);
                return src ? (
                  <Image key={pr.id} source={{ uri: src }} style={styles.proofImg} resizeMode="cover" />
                ) : (
                  <Text key={pr.id} style={styles.sub}>Photo unavailable</Text>
                );
              })}
            </ScrollView>
            <Text style={styles.sub}>
              Recorded {order.proofs![0]?.capturedName ?? '—'} · {timeAgo(order.proofs![0]?.capturedAt ?? new Date().toISOString())}
            </Text>
          </Card>
        )}

        {(order.events?.length ?? 0) > 0 && (
          <Card>
            <Text style={styles.sectionTitle}>Timeline</Text>
            {order.events!.map((ev) => (
              <View key={ev.id} style={styles.eventRow}>
                <View style={styles.eventDot} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.eventStatus}>{humanize(ev.status)}</Text>
                  <Text style={styles.sub}>{timeAgo(ev.createdAt)}{ev.note ? ` · ${ev.note}` : ''}</Text>
                </View>
              </View>
            ))}
          </Card>
        )}
      </ScrollView>

      {/* ── POD capture modal ── */}
      <Modal visible={podOpen} animationType="slide" onRequestClose={() => setPodOpen(false)}>
        <Screen style={{ paddingTop: 40 }}>
          <Text style={styles.modalTitle}>Proof of delivery</Text>
          <ScrollView>
            <Card>
              <Field label="Received by">
                <TextInput
                  style={styles.input}
                  value={capturedName}
                  onChangeText={setCapturedName}
                  placeholder="Name of the person accepting the cargo"
                  placeholderTextColor={theme.colors.muted}
                />
              </Field>
              {order.isCOD && (
                <Field label={`COD collected (${order.currency})`}>
                  <TextInput
                    style={styles.input}
                    value={codCollected}
                    onChangeText={setCodCollected}
                    keyboardType="numeric"
                    placeholder={String(order.codAmount)}
                    placeholderTextColor={theme.colors.muted}
                  />
                </Field>
              )}
              <Button label="Add photos" variant="outline" onPress={choosePhotos} />
              <View style={styles.thumbs}>
                {podAssets.map((a, i) => (
                  <Image key={`${a.uri}-${i}`} source={{ uri: a.uri }} style={styles.thumb} resizeMode="cover" />
                ))}
              </View>
              {podAssets.length === 0 && (
                <Text style={styles.hint}>Take 1–4 photos of the delivered cargo / signed paperwork.</Text>
              )}
            </Card>
            <Button label="Confirm delivery" loading={busy === 'DELIVERED'} onPress={confirmDelivery} style={{ marginBottom: 10 }} />
            <Button label="Cancel" variant="ghost" onPress={() => setPodOpen(false)} />
          </ScrollView>
        </Screen>
      </Modal>

      {/* ── Failure report modal ── */}
      <Modal visible={failOpen} animationType="slide" transparent onRequestClose={() => setFailOpen(false)}>
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <Text style={styles.modalTitle}>Delivery failed</Text>
            <Text style={styles.sectionTitle}>Reason</Text>
            <View style={styles.reasonGrid}>
              {FAILED_REASONS.map((r) => (
                <Pressable
                  key={r}
                  onPress={() => setFailReason(r)}
                  style={[styles.reasonChip, failReason === r && styles.reasonChipActive]}
                >
                  <Text style={[styles.reasonText, failReason === r && styles.reasonTextActive]}>{humanize(r)}</Text>
                </Pressable>
              ))}
            </View>
            <Field label="Note (optional)">
              <TextInput
                style={styles.input}
                value={failNote}
                onChangeText={setFailNote}
                multiline
                placeholder="What happened at the stop?"
                placeholderTextColor={theme.colors.muted}
              />
            </Field>
            <Button label="Report failure" variant="danger" loading={busy === 'FAILED'} onPress={submitFailure} style={{ marginBottom: 10 }} />
            <Button label="Cancel" variant="ghost" onPress={() => setFailOpen(false)} />
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

/** Best-effort current coords — the task flow must not fail if GPS is denied. */
async function getCurrentCoords(): Promise<{ latitude: number; longitude: number } | null> {
  try {
    const Location = require('expo-location');
    const pos = await Location.getLastKnownPositionAsync({ maxAge: 60000 }).catch(() => null);
    const current = pos ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }).catch(() => null));
    if (!current) return null;
    return { latitude: current.coords.latitude, longitude: current.coords.longitude };
  } catch {
    return null;
  }
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  orderNo: { fontSize: 17, fontWeight: '800', color: theme.colors.text },
  tracking: { fontSize: 12, color: theme.colors.muted, marginTop: 2 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  chip: { fontSize: 12, fontWeight: '600', color: theme.colors.muted, backgroundColor: theme.colors.bg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: theme.colors.muted, marginBottom: 8, textTransform: 'uppercase' },
  addr: { fontSize: 15, color: theme.colors.text, fontWeight: '600' },
  sub: { fontSize: 13, color: theme.colors.muted, marginTop: 4 },
  note: { fontSize: 13, color: theme.colors.warning, marginTop: 8, fontWeight: '600' },
  barcode: { fontSize: 12, color: theme.colors.text, marginTop: 3, fontFamily: 'monospace' },
  cod: { fontSize: 14, color: theme.colors.warning, fontWeight: '700', marginTop: 8 },
  btnRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  flexBtn: { flex: 1 },
  proofImg: { width: 110, height: 110, borderRadius: 10, marginRight: 8 },
  eventRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  eventDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: theme.colors.primary, marginTop: 4 },
  eventStatus: { fontSize: 14, fontWeight: '700', color: theme.colors.text },
  errorText: { fontSize: 15, color: theme.colors.danger, marginBottom: 12 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: theme.colors.text, marginBottom: 12 },
  input: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: theme.colors.text, minHeight: 46, backgroundColor: theme.colors.card },
  thumbs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  thumb: { width: 84, height: 84, borderRadius: 10 },
  hint: { fontSize: 12, color: theme.colors.muted, marginTop: 10 },
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: theme.colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  reasonGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  reasonChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: theme.colors.border },
  reasonChipActive: { backgroundColor: theme.colors.danger, borderColor: theme.colors.danger },
  reasonText: { fontSize: 13, fontWeight: '600', color: theme.colors.text },
  reasonTextActive: { color: '#fff' },
});
