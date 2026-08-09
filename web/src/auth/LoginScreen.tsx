import { Navigate } from 'react-router-dom';
import { useAuth } from './useAuth';
import { AccentButton } from '../ui/AccentButton';
import { WaveMark } from '../ui/WaveMark';

export function LoginScreen() {
  const { user, signIn } = useAuth();
  if (user) return <Navigate to="/" replace />;
  return (
    <main className="relative mx-auto flex min-h-full max-w-md flex-col justify-center gap-8 overflow-hidden p-6">
      {/* Giant background wave — pure atmosphere. */}
      <WaveMark className="pointer-events-none absolute -bottom-8 left-1/2 h-44 w-[150%] -translate-x-1/2 text-accent opacity-[0.05]" />

      <div className="flex flex-col items-center gap-4 text-center">
        <WaveMark className="h-16 w-28 text-accent drop-shadow-[0_0_26px_rgba(67,201,255,0.45)]" />
        <span className="text-[13px] font-extrabold tracking-[6px] text-ink">RIPTIDE</span>
        <h1 className="text-[44px] font-extrabold leading-none text-ink">Train.</h1>
        <p className="max-w-[30ch] text-[14px] leading-relaxed text-ink-dim">
          Programs built around your life. Logging that keeps up.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <AccentButton onClick={signIn}>Sign in with Google</AccentButton>
        <p className="text-center text-[11px] text-ink-faint">Free · installs to your home screen · works offline</p>
      </div>
    </main>
  );
}
