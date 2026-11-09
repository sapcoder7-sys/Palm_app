import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect } from 'expo-router';
import { Api, normalizeServer } from '../lib/api';
import { User } from '../lib/types';
import { errorText } from '../lib/format';
import { Button, ErrorBox, Field, Icon, s } from '../components/ui';
import { useSession } from '../state/session';

const API_SERVER = 'https://palm-app-3j9n.onrender.com';

export default function Login() {
  const { session, setSession } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (session) return <Redirect href="/(tabs)" />;
  async function login() {
    if (busy) return;
    setError('');
    try {
      const api = new Api(normalizeServer(API_SERVER, __DEV__));
      if (!email.trim().includes('@') || !password) throw new Error('Enter your user ID (email) and password.');
      setBusy(true);
      const result = await api.call<{ token: string; user: User }>('/auth/login', 'POST', { email: email.trim(), password });
      api.token = result.token; api.onUnauthorized = () => setSession(null);
      setPassword(''); setSession({ api, user: result.user });
    } catch (e) { setError(errorText(e)); }
    finally { setBusy(false); }
  }
  return <SafeAreaView style={s.screen}><KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 26 }}>
      <View style={{ width: '100%', maxWidth: 460, alignSelf: 'center' }}>
        <View style={{ alignItems: 'center', gap: 10, marginBottom: 40 }}><Icon name="leaf" size={58} /><Text style={[s.h1, { fontSize: 42 }]}>Palm</Text><Text style={s.muted}>Every payment. A clearer picture.</Text></View>
        <Text style={s.h1}>Welcome back</Text><Text style={[s.muted, { marginTop: 8, marginBottom: 24 }]}>Sign in to your business workspace.</Text>
        <Field label="User ID (email)" value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="username" />
        <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry maxLength={256} autoComplete="current-password" onSubmitEditing={() => void login()} />
        {!!error && <View style={{ marginBottom: 15 }}><ErrorBox message={error} /></View>}
        <Button label={busy ? 'Signing in…' : 'Sign in'} disabled={busy} onPress={() => void login()} />
        <Text style={[s.muted, { textAlign: 'center', marginTop: 24, fontSize: 12 }]}>Use the user ID and password provided by your administrator.</Text>
      </View>
    </ScrollView>
  </KeyboardAvoidingView></SafeAreaView>;
}
