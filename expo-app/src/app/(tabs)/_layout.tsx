import { Redirect, Tabs } from 'expo-router';
import { ColorValue } from 'react-native';
import { useSession } from '../../state/session';
import { WorkspaceProvider } from '../../state/workspace';
import { colors, Icon, IconName } from '../../components/ui';

export default function TabsLayout() {
  const { session } = useSession();
  if (!session) return <Redirect href="/login" />;
  const icon = (name: IconName) => function TabIcon({ color }: { color: ColorValue }) { return <Icon name={name} color={typeof color === 'string' ? color : colors.green} />; };
  return <WorkspaceProvider><Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: colors.green, tabBarInactiveTintColor: colors.muted, tabBarStyle: { backgroundColor: 'white', borderTopColor: colors.line }, tabBarLabelStyle: { fontSize: 11, fontWeight: '600' } }}>
    <Tabs.Screen name="index" options={{ title: 'Overview', tabBarIcon: icon('grid-outline') }} />
    <Tabs.Screen name="payments" options={{ title: 'Payments', tabBarIcon: icon('wallet-outline') }} />
    <Tabs.Screen name="returns" options={{ title: 'Returns', tabBarIcon: icon('return-down-back-outline') }} />
    <Tabs.Screen name="team" options={{ title: 'Team', href: session.user.role === 'admin' ? undefined : null, tabBarIcon: icon('people-outline') }} />
    <Tabs.Screen name="account" options={{ title: 'Account', tabBarIcon: icon('person-circle-outline') }} />
  </Tabs></WorkspaceProvider>;
}
