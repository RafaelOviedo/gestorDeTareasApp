import { createContext, useContext, useState } from 'react';
import type { PropsWithChildren } from 'react';
import { authenticateUser } from '../services/auth';
import type { User } from '../types/user';

type AuthContextValue = {
  user: User | null;
  signIn: (username: string, password: string) => Promise<void>;
  signOut: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: PropsWithChildren) {
  // Las cuentas persisten, pero al abrir la app se debe volver a iniciar sesión.
  const [user, setUser] = useState<User | null>(null);

  async function signIn(username: string, password: string) {
    const authenticatedUser = await authenticateUser(username, password);
    setUser(authenticatedUser);
  }

  function signOut() {
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe usarse dentro de AuthProvider.');
  }
  return context;
}
