import { Navigate } from 'react-router-dom';
import { useAuth } from './useAuth';
import { AccentButton } from '../ui/AccentButton';
import { Eyebrow } from '../ui/Eyebrow';

export function LoginScreen() {
  const { user, signIn } = useAuth();
  if (user) return <Navigate to="/" replace />;
  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col justify-center gap-6 p-6">
      <Eyebrow>Riptide</Eyebrow>
      <h1 className="text-4xl font-extrabold text-ink">Train.</h1>
      <p className="text-ink-dim">Sign in to build and log your programs.</p>
      <AccentButton onClick={signIn}>Sign in with Google</AccentButton>
    </main>
  );
}
