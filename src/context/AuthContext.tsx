import { createContext, useContext, useEffect, useState } from 'react';
import type { PropsWithChildren } from 'react';
import {
  authenticateUser,
  clearSession,
  restoreSession,
  saveSession,
} from '../services/auth';
import type { User } from '../types/user';

type AuthContextValue = {
  user: User | null;
  signIn: (username: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  isRestoring: boolean;
  restoreError: string | null;
  retryRestore: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<User | null>(null);
  const [isRestoring, setIsRestoring] = useState(true);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [restoreAttempt, setRestoreAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    async function loadSession() {
      try {
        const savedUser = await restoreSession();
        if (active) {
          setUser(savedUser);
        }
      } catch (cause) {
        if (active) {
          setRestoreError(
            cause instanceof Error
              ? cause.message
              : 'No se pudo recuperar la sesión.',
          );
        }
      } finally {
        if (active) {
          setIsRestoring(false);
        }
      }
    }
    loadSession();
    return () => {
      active = false;
    };
  }, [restoreAttempt]);

  function retryRestore() {
    setRestoreError(null);
    setIsRestoring(true);
    setRestoreAttempt(current => current + 1);
  }

  async function signIn(username: string, password: string) {
    const authenticatedUser = await authenticateUser(username, password);
    await saveSession(authenticatedUser.id);
    setUser(authenticatedUser);
  }

  async function signOut() {
    await clearSession();
    setUser(null);
  }

  return (
    <AuthContext.Provider
      value={{ user, signIn, signOut, isRestoring, restoreError, retryRestore }}
    >
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
