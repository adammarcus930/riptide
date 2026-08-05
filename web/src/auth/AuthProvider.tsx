import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  GoogleAuthProvider,
  getRedirectResult,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut as fbSignOut,
  type User,
} from 'firebase/auth';
import { auth } from '../firebase';
import { AuthContext, type AuthState } from './AuthContext';

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
    getRedirectResult(auth).catch((err) => console.error('google sign-in redirect failed', err));
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      signIn: async () => {
        // Popup is reliable on desktop/dev; fall back to redirect (better for
        // installed iOS PWAs, where popups are awkward).
        try {
          await signInWithPopup(auth, new GoogleAuthProvider());
        } catch (err) {
          console.error('google sign-in (popup) failed; falling back to redirect', err);
          try {
            await signInWithRedirect(auth, new GoogleAuthProvider());
          } catch (e) {
            console.error('google sign-in (redirect) failed', e);
          }
        }
      },
      signOut: () => void fbSignOut(auth),
    }),
    [user, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
