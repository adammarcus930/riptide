// The Riptide wave — the app-icon mark, usable inside the app (login, empty
// states). Strokes inherit currentColor; the echo wave rides at 35% opacity.
export function WaveMark({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 40" fill="none" className={className} aria-hidden="true">
      <path d="M4 14c8-11 16-11 24 0s16 11 24 0" stroke="currentColor" strokeWidth="7" strokeLinecap="round" />
      <path d="M4 29c8-8 16-8 24 0s16 8 24 0" stroke="currentColor" strokeWidth="5" strokeLinecap="round" opacity="0.35" />
    </svg>
  );
}
