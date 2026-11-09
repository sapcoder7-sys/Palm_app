import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Crypto from 'expo-crypto';
import { useSession } from '../state/session';
import { errorText, money, validAmount } from '../lib/format';
import { Payment } from '../lib/types';
import { Button, Choices, ErrorBox, Field, s } from './ui';

export function EntryModal({ kind, payment, close, saved }: { kind: 'payment' | 'refund' | 'employee'; payment?: Payment; close: () => void; saved: () => void }) {
  const { session } = useSession();
  const [values, setValues] = useState<Record<string, string>>({ method: 'Cash', status: 'paid', role: 'employee' });
  const [requestKey] = useState(() => Crypto.randomUUID());
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const set = (name: string, value: string) => setValues(previous => ({ ...previous, [name]: value }));
  const field = (name: string, label: string, options: Partial<React.ComponentProps<typeof Field>> = {}) => <Field key={name} label={label} value={values[name] || ''} onChangeText={value => set(name, value)} editable={!busy} {...options} />;
  async function save() {
    if (!session || lock.current) return;
    setError('');
    try {
      const data: Record<string, string> = Object.fromEntries(Object.entries(values).map(([key, value]) => [key, key === 'password' ? value : value.trim()]));
      if (kind !== 'employee' && !validAmount(data.amount || '')) throw new Error('Enter an amount from 0.01 to 100,000,000 with up to two decimal places.');
      if (kind === 'payment' && !data.customer) throw new Error('Enter a customer name.');
      if (kind === 'refund' && !data.reason) throw new Error('Enter a reason for the refund.');
      if (kind === 'employee' && (!data.name || !data.email?.includes('@') || (data.password?.length || 0) < 12)) throw new Error('Enter a name, valid email and a password with at least 12 characters.');
      lock.current = true; setBusy(true);
      const path = kind === 'employee' ? '/employees' : kind === 'refund' ? '/refunds' : '/payments';
      if (kind !== 'employee') data.idempotency_key = requestKey;
      if (payment) data.payment_id = payment.id;
      await session.api.call(path, 'POST', data); saved();
    } catch (e) { setError(errorText(e)); }
    finally { lock.current = false; setBusy(false); }
  }
  return <Modal visible animationType="slide" onRequestClose={() => { if (!busy) close(); }}><SafeAreaView style={s.screen}>
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.content}>
        <Text style={s.h1}>{kind === 'payment' ? 'Record payment' : kind === 'refund' ? 'Request refund' : 'Add team member'}</Text>
        <Text style={s.muted}>{kind === 'payment' ? 'Keep every collection accounted for.' : kind === 'refund' ? `${payment?.customer} · Paid ${money(payment?.amount_paise)}` : 'Choose the account details and access role.'}</Text>
        <View style={{ marginTop: 12 }}>
          {kind === 'payment' && <>{field('customer', 'Customer name')}{field('amount', 'Amount (INR)', { keyboardType: 'decimal-pad', maxLength: 15 })}
            <Choices label="Payment method" options={['Cash', 'UPI', 'Bank', 'Card']} value={values.method} onChange={value => set('method', value)} />
            <Choices label="Payment status" options={['paid', 'pending']} value={values.status} onChange={value => set('status', value)} />
            {field('reference', 'Reference / receipt number (optional)')}{field('notes', 'Notes (optional)', { multiline: true, maxLength: 1000 })}</>}
          {kind === 'refund' && <>{field('amount', 'Refund amount (INR)', { keyboardType: 'decimal-pad', maxLength: 15 })}{field('reason', 'Reason for refund', { multiline: true, maxLength: 1000 })}</>}
          {kind === 'employee' && <>{field('name', 'Full name')}{field('email', 'Email', { autoCapitalize: 'none', keyboardType: 'email-address', autoCorrect: false })}{field('phone', 'Phone (optional)', { keyboardType: 'phone-pad', maxLength: 30 })}{field('password', 'Initial password', { secureTextEntry: true, maxLength: 256 })}<Choices label="Access role" options={['employee', 'admin']} value={values.role} onChange={value => set('role', value)} /></>}
        </View>
        {!!error && <ErrorBox message={error} />}
        <Button label={busy ? 'Saving…' : 'Save'} disabled={busy} onPress={() => void save()} />
        <Button label="Cancel" secondary disabled={busy} onPress={close} />
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView></Modal>;
}
