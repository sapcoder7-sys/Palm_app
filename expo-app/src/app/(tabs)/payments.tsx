import { useState } from 'react';
import { Alert, Modal, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { useWorkspace } from '../../state/workspace';
import { Payment } from '../../lib/types';
import { money } from '../../lib/format';
import { Screen } from '../../components/Screen';
import { PaymentCard } from '../../components/PaymentCard';
import { EntryModal } from '../../components/EntryModal';
import { Badge, Button, Choices, Empty, Field, s } from '../../components/ui';

export default function Payments() {
  const { payments, refresh, busy, action } = useWorkspace();
  const { paymentId } = useLocalSearchParams<{ paymentId?: string }>();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = payments.find(payment => payment.id === (paymentId || selectedId)) || null;
  const setSelected = (payment: Payment | null) => {
    setSelectedId(payment?.id || null);
    if (paymentId) router.setParams({ paymentId: '' });
  };
  const [entry, setEntry] = useState<'payment' | 'refund' | null>(null);
  const [refundPayment, setRefundPayment] = useState<Payment | undefined>();
  const visible = payments.filter(p => (filter === 'all' || p.status === filter) && `${p.customer} ${p.reference} ${p.employee_name}`.toLowerCase().includes(query.toLowerCase()));
  return <><Screen title="Payments">
    <Field label="Search payments" placeholder="Customer, reference or employee" value={query} onChangeText={setQuery} />
    <Choices label="Status" options={['all', 'paid', 'pending']} value={filter} onChange={setFilter} />
    <Button label="Record payment" icon="add" onPress={() => setEntry('payment')} />
    <Text style={s.muted}>{visible.length} transactions</Text>
    {visible.length ? visible.map(p => <PaymentCard key={p.id} payment={p} onPress={() => setSelected(p)} />) : <Empty heading="No matching payments" detail="New payments will appear here." />}
  </Screen>
    <Modal visible={!!selected} animationType="slide" onRequestClose={() => { if (!busy) setSelected(null); }}><SafeAreaView style={s.screen}><ScrollView contentContainerStyle={s.content}>{selected && <>
      <Text style={s.h1}>{selected.customer}</Text><Text style={[s.h1, { fontSize: 36 }]}>{money(selected.amount_paise)}</Text><Badge status={selected.status} />
      <View style={s.card}><Text style={s.text}>Method: {selected.method}</Text><Text style={s.text}>Employee: {selected.employee_name}</Text><Text style={s.text}>Reference: {selected.reference || '—'}</Text><Text style={s.text}>Refunded: {money(selected.refunded_paise)}</Text><Text style={s.muted}>Created: {selected.created_at}</Text>{!!selected.notes && <Text style={s.text}>{selected.notes}</Text>}</View>
      {selected.status === 'pending' ? <Button label="Mark paid" disabled={busy} onPress={() => Alert.alert('Confirm payment received', `Record ${money(selected.amount_paise)} from ${selected.customer} as paid?`, [{ text: 'Cancel', style: 'cancel' }, { text: 'Confirm', onPress: () => { void action(`/payments/${selected.id}/paid`).then(ok => { if (ok) setSelected(null); }); } }])} /> : <Button label="Request refund" disabled={busy} onPress={() => { setRefundPayment(selected); setSelected(null); setEntry('refund'); }} />}
      <Button label="Close" secondary disabled={busy} onPress={() => setSelected(null)} />
    </>}</ScrollView></SafeAreaView></Modal>
    {entry && <EntryModal kind={entry} payment={refundPayment} close={() => setEntry(null)} saved={() => { setEntry(null); void refresh(); }} />}
  </>;
}
