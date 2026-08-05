import { createContext } from 'react';
import type { User } from 'firebase/auth';

export interface AuthState {
  user: User | null;
  loading: boolean;
  signIn: () => void;
  signOut: () => void;
}

export const AuthContext = createContext<AuthState | undefined>(undefined);
