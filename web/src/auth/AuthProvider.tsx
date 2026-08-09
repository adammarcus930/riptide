import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  GoogleAuthProvider,
  getRedirectResult,
  onAuthStateChanged,
  signInWithRedirect,
  signOut as fbSignOut,
  type User,
} from 'firebase/auth';
import { auth } from '../firebase';
import { AuthContext, type AuthState } from './AuthContext';
import { toast } from '../ui/toast';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    getRedirectResult(auth).catch((err) => {
      console.error('google sign-in redirect failed', err);
      toast("Sign-in didn't complete — try again.");
    });
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      signIn: () => {
        // Redirect flow only — reliable across mobile browsers and the installed
        // PWA (popups are silently blocked on many mobile browsers, which looked
        // like "the button does nothing"). authDomain is same-origin, so the
        // redirect handler keeps its sessionStorage state.
        signInWithRedirect(auth, new GoogleAuthProvider()).catch((err) => {
          console.error('google sign-in failed', err);
          toast("Couldn't start sign-in — try again.");
        });
      },
      signOut: () => void fbSignOut(auth),
    }),
    [user, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
