import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { User, SignInInput, SignUpInput } from '../../../shared/contracts';
import { ApiError, authApi } from '../lib/api';

type AuthStatus = 'loading' | 'signedIn' | 'signedOut' | 'unavailable';
interface AuthContextValue {
  user: User | null;
  status: AuthStatus;
  retrySession: () => void;
  signIn: (input: SignInInput) => Promise<void>;
  signUp: (input: SignUpInput) => Promise<void>;
  signOut: () => Promise<void>;
}
const AuthContext = createContext<AuthContextValue | undefined>(undefined);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setStatus('loading');
    authApi
      .me(controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) {
          setUser(result.user);
          setStatus('signedIn');
        }
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setUser(null);
        setStatus(error instanceof ApiError && error.status === 401 ? 'signedOut' : 'unavailable');
      });
    return () => controller.abort();
  }, [attempt]);
  useEffect(() => {
    const expired = () => {
      setUser(null);
      setStatus('signedOut');
    };
    window.addEventListener('retain:session-expired', expired);
    return () => window.removeEventListener('retain:session-expired', expired);
  }, []);
  const signIn = useCallback(async (input: SignInInput) => {
    const result = await authApi.signIn(input);
    setUser(result.user);
    setStatus('signedIn');
  }, []);
  const signUp = useCallback(async (input: SignUpInput) => {
    const result = await authApi.signUp(input);
    setUser(result.user);
    setStatus('signedIn');
  }, []);
  const signOut = useCallback(async () => {
    await authApi.signOut();
    setUser(null);
    setStatus('signedOut');
  }, []);
  const retrySession = useCallback(() => setAttempt((value) => value + 1), []);
  const value = useMemo(
    () => ({ user, status, signIn, signUp, signOut, retrySession }),
    [user, status, signIn, signUp, signOut, retrySession],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider.');
  return context;
}
