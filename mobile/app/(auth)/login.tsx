import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useSignIn } from '@clerk/clerk-expo';
import { Button } from '@/components/ui';
import { theme } from '@/theme';

export default function LoginScreen() {
  const { signIn, isLoaded } = useSignIn();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSignIn() {
    if (!isLoaded || !signIn) return;
    setBusy(true);
    setError(null);
    try {
      const res = await signIn.create({ identifier, password });
      if (res.status !== 'complete') {
        // e.g. requires 2FA — not handled in this driver build.
        setError('Additional verification required. Please sign in on the web first.');
      }
    } catch (e: any) {
      setError(e?.errors?.[0]?.longMessage ?? e?.message ?? 'Unable to sign in.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.wrap}>
      <View style={styles.card}>
        <Text style={styles.brand}>SwiftFreight</Text>
        <Text style={styles.title}>Driver sign in</Text>
        <Text style={styles.subtitle}>Use your work account to start your shift.</Text>

        <TextInput
          style={styles.input}
          placeholder="Email or username"
          autoCapitalize="none"
          value={identifier}
          onChangeText={setIdentifier}
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        {error && <Text style={styles.error}>{error}</Text>}

        <Button label="Sign in" onPress={onSignIn} loading={busy} disabled={!identifier || !password} />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 420, backgroundColor: theme.colors.card, borderRadius: 16, padding: 24 },
  brand: { color: theme.colors.primary, fontWeight: '800', fontSize: 14, textTransform: 'uppercase', letterSpacing: 1 },
  title: { fontSize: 26, fontWeight: '800', color: theme.colors.text, marginTop: 4 },
  subtitle: { fontSize: 14, color: theme.colors.muted, marginTop: 4, marginBottom: 20 },
  input: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: 10, paddingHorizontal: 14, height: 48, marginBottom: 12, fontSize: 16, backgroundColor: '#fff' },
  error: { color: theme.colors.danger, fontSize: 13, marginBottom: 12 },
});
