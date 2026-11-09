import { useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { Redirect } from 'expo-router';
import { useSession } from '../../state/session';
import { useWorkspace } from '../../state/workspace';
import { Screen } from '../../components/Screen';
import { EntryModal } from '../../components/EntryModal';
import { Badge, Button, s } from '../../components/ui';
import { title } from '../../lib/format';

export default function Team() {
  const { session } = useSession();
  const { employees, busy, action, refresh } = useWorkspace();
  const [entry, setEntry] = useState(false);
  if (session?.user.role !== 'admin') return <Redirect href="/(tabs)" />;
  return <><Screen title="Team"><Text style={s.h1}>Your team</Text><Text style={s.muted}>Manage employee accounts and access.</Text><Button label="Add employee" icon="add" onPress={() => setEntry(true)} />
    {employees.map(employee => <View key={employee.id} style={s.card}><View style={s.between}><Text style={[s.h2, { flex: 1 }]}>{employee.name}</Text><Text style={s.muted}>{title(employee.role)}</Text></View><Text style={s.text}>{employee.email}</Text>{!!employee.phone && <Text style={s.text}>{employee.phone}</Text>}<Badge status={employee.active ? 'active' : 'inactive'} />
      {employee.id !== session.user.id && <Button secondary label={employee.active ? 'Deactivate account' : 'Activate account'} disabled={busy} onPress={() => Alert.alert('Change account access', `Change access for ${employee.name}?`, [{ text: 'Cancel', style: 'cancel' }, { text: 'Confirm', onPress: () => { void action(`/employees/${employee.id}`, { active: !employee.active }, 'PATCH'); } }])} />}
    </View>)}
  </Screen>{entry && <EntryModal kind="employee" close={() => setEntry(false)} saved={() => { setEntry(false); void refresh(); }} />}</>;
}
