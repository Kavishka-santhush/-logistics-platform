import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import type { Socket } from 'socket.io-client';
import { Screen, Card, Button } from '@/components/ui';
import { api } from '@/lib/api';
import { getSocket, onSocket } from '@/lib/socket';
import { useAuthStore } from '@/lib/authStore';
import { theme } from '@/theme';
import { timeAgo, formatCurrency } from '@/lib/format';
import type { DriverMessageFull } from '@/types';

interface PendingOffer {
  id: string;
  status: string;
  notes?: string | null;
  dispatchedAt: string;
  order?: {
    id: string;
    orderNumber: string;
    trackingNumber: string;
    deliveryAddressLine?: string;
    deliveryCity?: string | null;
    codAmount?: string | null;
    currency?: string | null;
  } | null;
  vehicle?: { id: string; plateNumber: string; type: string } | null;
  route?: { id: string; name: string } | null;
}

export default function MessagesScreen() {
  const driverId = useAuthStore((s) => s.driverId)();

  const [messages, setMessages] = useState<DriverMessageFull[]>([]);
  const [offers, setOffers] = useState<PendingOffer[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!driverId) return;
    try {
      const [thread, pending] = await Promise.all([
        api.get<DriverMessageFull[]>(`/dispatch/drivers/${driverId}/conversation`),
        api.get<PendingOffer[]>(`/dispatch/drivers/${driverId}/pending`).catch(() => []),
      ]);
      setMessages(Array.isArray(thread) ? thread : []);
      setOffers(Array.isArray(pending) ? pending : []);
    } catch {
      /* keep whatever is already on screen */
    } finally {
      setLoading(false);
    }
  }, [driverId]);

  useEffect(() => {
    load();
  }, [load]);

  // Realtime: dispatcher messages + new/updated assignment offers.
  useEffect(() => {
    if (!driverId) return;
    const offMsg = onSocket('message:received', (msg: DriverMessageFull) => {
      if (msg?.driverId === driverId) setMessages((prev) => [...prev, msg]);
    });
    const offDispatch = onSocket('dispatch:updated', () => {
      api.get<PendingOffer[]>(`/dispatch/drivers/${driverId}/pending`).then(setOffers).catch(() => {});
    });
    return () => {
      offMsg();
      offDispatch();
    };
  }, [driverId]);

  async function send() {
    const body = draft.trim();
    if (!body || !driverId) return;
    setDraft('');
    const optimistic: DriverMessageFull = {
      id: `local-${Date.now()}`,
      driverId,
      body,
      isFromDriver: true,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    setSending(true);
    try {
      const socket: Socket = getSocket();
      if (socket.connected) {
        socket.emit('message:reply', { body });
      } else {
        await api.post(`/dispatch/drivers/${driverId}/message/reply`, { body });
      }
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      Alert.alert('Message not sent', 'Please retry.');
    } finally {
      setSending(false);
    }
  }

  function respond(offerId: string, action: 'accept' | 'reject', reason?: string) {
    const socket: Socket = getSocket();
    socket.emit('dispatch:respond', { dispatchId: offerId, action, reason });
    socket.once('dispatch:respond:ack', () => {
      setOffers((prev) => prev.filter((o) => o.id !== offerId));
      if (action === 'accept') load();
    });
    socket.once('dispatch:error', (e: { message?: string }) => {
      Alert.alert('Could not respond', e?.message ?? 'Please retry.');
    });
  }

  if (loading) {
    return (
      <Screen style={{ alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </Screen>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={80}
    >
      <Screen style={{ paddingBottom: 0 }}>
        {offers.length > 0 && (
          <View style={{ marginBottom: 8 }}>
            <Text style={styles.sectionTitle}>Assignment offers</Text>
            {offers.map((o) => (
              <Card key={o.id}>
                <Text style={styles.offerNo}>{o.order?.orderNumber ?? 'Route dispatch'}</Text>
                {!!o.order?.deliveryAddressLine && (
                  <Text style={styles.offerAddr}>
                    {o.order.deliveryAddressLine}
                    {o.order.deliveryCity ? `, ${o.order.deliveryCity}` : ''}
                  </Text>
                )}
                {!!o.vehicle && <Text style={styles.offerMeta}>Vehicle: {o.vehicle.plateNumber}</Text>}
                {!!o.order?.codAmount && Number(o.order.codAmount) > 0 && (
                  <Text style={styles.offerCod}>COD {formatCurrency(o.order.codAmount, o.order.currency ?? 'EUR')}</Text>
                )}
                <View style={styles.offerBtns}>
                  <Button label="Accept" onPress={() => respond(o.id, 'accept')} style={{ flex: 1, marginRight: 8 }} />
                  <Button
                    label="Reject"
                    variant="danger"
                    onPress={() =>
                      Alert.prompt
                        ? Alert.prompt('Reject reason', 'Why are you rejecting?', (reason) => respond(o.id, 'reject', reason))
                        : respond(o.id, 'reject', 'Rejected')
                    }
                    style={{ flex: 1 }}
                  />
                </View>
              </Card>
            ))}
          </View>
        )}

        <Text style={styles.sectionTitle}>Conversation with dispatch</Text>
        <FlatList
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ paddingBottom: 12 }}
          ListEmptyComponent={<Text style={styles.empty}>No messages yet. Anything you send goes straight to the dispatcher.</Text>}
          renderItem={({ item }) => {
            const mine = item.isFromDriver;
            return (
              <View style={[styles.bubbleRow, mine ? { justifyContent: 'flex-end' } : null]}>
                <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                  <Text style={[styles.bubbleText, mine ? { color: '#fff' } : null]}>{item.body}</Text>
                  <Text style={[styles.bubbleTime, mine ? { color: 'rgba(255,255,255,0.8)' } : null]}>
                    {timeAgo(item.createdAt)}
                  </Text>
                </View>
              </View>
            );
          }}
        />

        <View style={styles.composer}>
          <TextInput
            style={styles.input}
            value={draft}
            onChangeText={setDraft}
            placeholder="Message dispatcher…"
            placeholderTextColor={theme.colors.muted}
            multiline
          />
          <Pressable
            onPress={send}
            disabled={!draft.trim() || sending}
            style={({ pressed }) => [
              styles.sendBtn,
              { opacity: !draft.trim() || sending ? 0.5 : pressed ? 0.85 : 1 },
            ]}
          >
            {sending ? <ActivityIndicator color="#fff" /> : <Text style={styles.sendText}>Send</Text>}
          </Pressable>
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  sectionTitle: { fontSize: 13, fontWeight: '700', color: theme.colors.muted, marginBottom: 8, textTransform: 'uppercase' },
  offerNo: { fontSize: 15, fontWeight: '700', color: theme.colors.text },
  offerAddr: { fontSize: 13, color: theme.colors.text, marginTop: 4 },
  offerMeta: { fontSize: 12, color: theme.colors.muted, marginTop: 2 },
  offerCod: { fontSize: 13, color: theme.colors.warning, fontWeight: '700', marginTop: 4 },
  offerBtns: { flexDirection: 'row', marginTop: 12 },
  empty: { fontSize: 13, color: theme.colors.muted, marginTop: 8 },
  bubbleRow: { flexDirection: 'row', marginBottom: 8 },
  bubble: { maxWidth: '82%', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8 },
  bubbleMine: { backgroundColor: theme.colors.primary, borderBottomRightRadius: 4 },
  bubbleTheirs: { backgroundColor: theme.colors.border, borderBottomLeftRadius: 4 },
  bubbleText: { fontSize: 14, color: theme.colors.text },
  bubbleTime: { fontSize: 10, color: theme.colors.muted, marginTop: 2, alignSelf: 'flex-end' },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingVertical: 10, borderTopWidth: 1, borderTopColor: theme.colors.border },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: theme.colors.text,
    maxHeight: 100,
    backgroundColor: theme.colors.card,
  },
  sendBtn: { backgroundColor: theme.colors.primary, borderRadius: 12, paddingHorizontal: 18, height: 46, alignItems: 'center', justifyContent: 'center' },
  sendText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
