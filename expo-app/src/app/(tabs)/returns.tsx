import { Alert, Text, View } from 'react-native';
import { useSession } from '../../state/session';
import { useWorkspace } from '../../state/workspace';
import { money } from '../../lib/format';
import { Screen } from '../../components/Screen';
import { Badge, Button, Empty, s } from '../../components/ui';

export default function Returns() {
  const { session } = useSession();
  const { refunds, busy, action } = useWorkspace();
  return <Screen title="Returns"><Text style={s.h1}>Returns & refunds</Text><Text style={s.muted}>Open a paid transaction to request a refund. Approval records the refund; it does not transfer money.</Text>
    {!refunds.length && <Empty heading="No refund requests" detail="Requested, approved and rejected refunds appear here." />}
    {refunds.map(r => <View key={r.id} style={s.card}><View style={s.between}><Text style={[s.h2, { flex: 1 }]}>{r.customer}</Text><Text style={[s.text, { fontWeight: '700' }]}>{money(r.amount_paise)}</Text></View><Text style={s.text}>{r.reason}</Text><Text style={s.muted}>Requested by {r.employee_name}</Text><Badge status={r.status} />
      {session?.user.role === 'admin' && r.status === 'pending' && <View style={s.wrap}>{(['approved', 'rejected'] as const).map(status => <Button key={status} label={status === 'approved' ? 'Approve' : 'Reject'} secondary={status === 'rejected'} disabled={busy} onPress={() => Alert.alert(status === 'approved' ? 'Approve refund' : 'Reject refund', `${money(r.amount_paise)} for ${r.customer}`, [{ text: 'Cancel', style: 'cancel' }, { text: 'Confirm', onPress: () => { void action(`/refunds/${r.id}/review`, { status }); } }])} />)}</View>}
    </View>)}
  </Screen>;
}
