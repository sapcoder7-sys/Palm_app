import { Redirect } from 'expo-router';
import { useSession } from '../state/session';
export default function Index() { const { session } = useSession(); return <Redirect href={session ? '/(tabs)' : '/login'} />; }
