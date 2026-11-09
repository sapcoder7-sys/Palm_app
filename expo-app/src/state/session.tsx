import React, { createContext, useContext, useState } from 'react';
import { Api } from '../lib/api';
import { User } from '../lib/types';

type Session = { api: Api; user: User };
const Context = createContext<{ session: Session | null; setSession: (value: Session | null) => void }>({ session: null, setSession: () => {} });
export function SessionProvider({ children }: React.PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  return <Context.Provider value={{ session, setSession }}>{children}</Context.Provider>;
}
export const useSession = () => useContext(Context);
