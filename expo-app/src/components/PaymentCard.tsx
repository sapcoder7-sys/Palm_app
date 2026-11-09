import { Pressable, Text, View } from 'react-native';
import { Payment } from '../lib/types';
import { money } from '../lib/format';
import { Badge, colors, s } from './ui';

export function PaymentCard({ payment: p, onPress }: { payment: Payment; onPress?: () => void }) {
  const body = <View style={[s.card, s.row]}>
    <View style={{ backgroundColor: '#E5EFE5', width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: colors.green, fontSize: 19, fontWeight: '700' }}>{p.customer.charAt(0).toUpperCase()}</Text></View>
    <View style={{ flex: 1, gap: 5 }}><Text numberOfLines={1} style={[s.text, { fontWeight: '700' }]}>{p.customer}</Text><Text numberOfLines={1} style={[s.muted, { fontSize: 12 }]}>{p.method} · {p.employee_name}</Text></View>
    <View style={{ alignItems: 'flex-end', gap: 6 }}><Text style={[s.text, { fontWeight: '700' }]}>{money(p.amount_paise)}</Text><Badge status={p.status} /></View>
  </View>;
  return onPress ? <Pressable accessibilityRole="button" accessibilityLabel={`View payment from ${p.customer}`} onPress={onPress}>{body}</Pressable> : body;
}
