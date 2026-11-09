import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { useSession } from './session';
import { Dashboard, Payment, Refund, User } from '../lib/types';
import { errorText } from '../lib/format';

type Data = { dashboard: Dashboard; payments: Payment[]; refunds: Refund[]; employees: User[] };
type Workspace = Data & { loading: boolean; error: string; busy: boolean; refresh: () => Promise<void>; action: (path: string, data?: object, method?: string) => Promise<boolean> };
const empty: Data = { dashboard: { paid_paise: 0, pending_paise: 0, refunded_paise: 0, net_paise: 0, count: 0 }, payments: [], refunds: [], employees: [] };
const Context = createContext<Workspace | null>(null);
export function WorkspaceProvider({ children }: React.PropsWithChildren) {
  const { session } = useSession();
  const [data, setData] = useState(empty);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState('');
  const generation = useRef(0);
  const load = useCallback(async () => {
    if (!session) return;
    const current = ++generation.current;
    try {
      const [dashboard, payments, refunds, employees] = await Promise.all([
        session.api.call<Dashboard>('/dashboard'), session.api.call<Payment[]>('/payments'), session.api.call<Refund[]>('/refunds'),
        session.user.role === 'admin' ? session.api.call<User[]>('/employees') : Promise.resolve([]),
      ]);
      if (current === generation.current) { setData({ dashboard, payments, refunds, employees }); setError(''); }
    } catch (e) { if (current === generation.current) setError(errorText(e)); }
    finally { if (current === generation.current) setLoading(false); }
  }, [session]);
  const cancelLoad = useCallback(() => { generation.current++; }, []);
  // load waits for network I/O before updating state; this effect subscribes to remote data.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); return cancelLoad; }, [load, cancelLoad]);
  async function refresh() { setLoading(true); setError(''); await load(); }
  async function action(path: string, body?: object, method = 'POST') {
    if (!session || busyRef.current) return false;
    busyRef.current = true; setBusy(true);
    try { await session.api.call(path, method, body); await refresh(); return true; }
    catch (e) { Alert.alert('Unable to save', errorText(e)); return false; }
    finally { busyRef.current = false; setBusy(false); }
  }
  return <Context.Provider value={{ ...data, loading, error, busy, refresh, action }}>{children}</Context.Provider>;
}
export function useWorkspace() { const value = useContext(Context); if (!value) throw new Error('Workspace provider is missing.'); return value; }
