import { Navigate } from 'react-router-dom';
import { useAuth } from './useAuth';
import { AccentButton } from '../ui/AccentButton';
import { Eyebrow } from '../ui/Eyebrow';
import { WaveMark } from '../ui/WaveMark';

export function LoginScreen() {
  const { user, signIn } = useAuth();
  if (user) return <Navigate to="/" replace />;
  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col justify-center gap-6 p-6">
      <WaveMark className="h-12 w-20 text-accent" />
      <div>
        <Eyebrow>Riptide</Eyebrow>
        <h1 className="text-4xl font-extrabold text-ink">Train.</h1>
      </div>
      <p className="text-ink-dim">
        Programs built around your life. Logging that keeps up. Sign in and the wave does the rest.
      </p>
      <AccentButton onClick={signIn}>Sign in with Google</AccentButton>
    </main>
  );
}
