import { useState } from 'react';
import { Alert, Modal, ScrollView, Share, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { useSession } from '../../state/session';
import { Audit } from '../../lib/types';
import { errorText, title } from '../../lib/format';
import { Button, s } from '../../components/ui';

export default function Account() {
  const { session, setSession } = useSession();
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<{ title: string; text: string } | null>(null);
  async function showReport(audit: boolean) {
    if (!session || busy) return;
    setBusy(true);
    try {
      const text = audit ? (await session.api.call<Audit[]>('/audit')).map(row => `${row.created_at} · ${row.actor_name}\n${row.action} · ${row.entity_id}`).join('\n\n') : await session.api.call<string>('/reports/payments.csv', 'GET', undefined, true);
      setReport({ title: audit ? 'Activity history' : 'Payments CSV', text: text || 'No activity yet.' });
    } catch (e) { Alert.alert('Unable to load report', errorText(e)); }
    finally { setBusy(false); }
  }
  async function logout() {
    if (!session || busy) return;
    setBusy(true);
    try { await session.api.call('/auth/logout', 'POST'); }
    catch { Alert.alert('Signed out on this device', 'The server could not be reached. The server session will expire automatically.'); }
    finally { session.api.token = null; setSession(null); }
  }
  return <SafeAreaView style={s.screen} edges={['top', 'left', 'right']}><ScrollView contentContainerStyle={s.content}><Text style={s.h1}>Your account</Text>
    <View style={s.card}><Text style={s.h2}>{session?.user.name}</Text><Text style={s.text}>{session?.user.email}</Text><Text style={s.muted}>{title(session?.user.role || '')}</Text></View>
    {session?.user.role === 'admin' && <><Button label="Payments CSV" secondary disabled={busy} onPress={() => void showReport(false)} /><Button label="Activity history" secondary disabled={busy} onPress={() => void showReport(true)} /></>}
    <Button label={busy ? 'Please wait…' : 'Sign out'} disabled={busy} onPress={() => void logout()} />
    <Text style={s.muted}>Palm 1.0.0 · Payments are recorded manually. Your session stays in memory and ends when the app restarts.</Text>
  </ScrollView>
    <Modal visible={!!report} animationType="slide" onRequestClose={() => setReport(null)}><SafeAreaView style={s.screen}><ScrollView contentContainerStyle={s.content}><Text style={s.h1}>{report?.title}</Text><View style={s.wrap}><Button label="Copy" onPress={() => { void Clipboard.setStringAsync(report?.text || '').then(() => Alert.alert('Copied')); }} /><Button label="Share text" secondary onPress={() => { void Share.share({ message: report?.text || '' }).catch(e => Alert.alert('Unable to share', errorText(e))); }} /><Button label="Close" secondary onPress={() => setReport(null)} /></View><Text selectable style={s.text}>{report?.text}</Text></ScrollView></SafeAreaView></Modal>
  </SafeAreaView>;
}
