import { useState } from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSession } from '../../state/session';
import { useWorkspace } from '../../state/workspace';
import { money } from '../../lib/format';
import { Screen } from '../../components/Screen';
import { EntryModal } from '../../components/EntryModal';
import { PaymentCard } from '../../components/PaymentCard';
import { Button, colors, Empty, Icon, IconName, s } from '../../components/ui';

export default function Overview() {
  const { session } = useSession();
  const { dashboard: d, payments, refresh } = useWorkspace();
  const [entry, setEntry] = useState(false);
  const metrics: { label: string; value: string; icon: IconName; color: string }[] = [
    { label: 'Paid', value: money(d.paid_paise), icon: 'checkmark-circle-outline', color: colors.green },
    { label: 'Pending', value: money(d.pending_paise), icon: 'time-outline', color: colors.amber },
    { label: 'Refunds', value: money(d.refunded_paise), icon: 'return-down-back-outline', color: colors.red },
    { label: 'Transactions', value: String(d.count), icon: 'receipt-outline', color: colors.green },
  ];
  return <><Screen title="Overview">
    <View style={{ gap: 6 }}><Text style={s.h1}>Hello, {session?.user.name}</Text><Text style={s.muted}>{session?.user.role === 'admin' ? 'Your business' : 'Your collections'} at a glance · All time</Text></View>
    <View style={{ backgroundColor: colors.ink, padding: 25, borderRadius: 24, gap: 14, marginTop: 8 }}><Text style={{ color: '#B3D3BF', fontSize: 12, letterSpacing: 2 }}>NET COLLECTIONS</Text><Text adjustsFontSizeToFit numberOfLines={1} style={{ color: 'white', fontSize: 36, fontWeight: '800' }}>{money(d.net_paise)}</Text><Text style={{ color: '#B3D3BF', fontSize: 13 }}>Paid payments minus approved refunds</Text></View>
    <View style={[s.wrap, { justifyContent: 'space-between', gap: 12 }]}>{metrics.map(metric => <View key={metric.label} style={[s.card, { width: '48%', flexGrow: 1 }]}><Icon name={metric.icon} color={metric.color} /><Text adjustsFontSizeToFit numberOfLines={1} style={[s.h2, { fontSize: 23 }]}>{metric.value}</Text><Text style={s.muted}>{metric.label}</Text></View>)}</View>
    <Button label="Record payment" icon="add" onPress={() => setEntry(true)} />
    <View style={[s.between, { marginTop: 12 }]}><Text style={s.h2}>Recent activity</Text><Button label="View all" secondary onPress={() => router.push('/(tabs)/payments')} /></View>
    {payments.length ? payments.slice(0, 5).map(p => <PaymentCard key={p.id} payment={p} onPress={() => router.push({ pathname: '/(tabs)/payments', params: { paymentId: p.id } })} />) : <Empty heading="No payments yet" detail="Record your first payment to start tracking collections." />}
  </Screen>{entry && <EntryModal kind="payment" close={() => setEntry(false)} saved={() => { setEntry(false); void refresh(); }} />}</>;
}
