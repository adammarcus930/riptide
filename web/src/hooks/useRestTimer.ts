import { useEffect, useRef, useState } from 'react';

// Foreground rest countdown. `start()` (called when a set is completed) counts
// down from `targetSec` to 0, then into overtime. Idle shows the target as
// "ready". `past` marks rest-is-up. No notifications, no wake lock.
export function useRestTimer(targetSec: number): {
  running: boolean;
  remaining: number; // seconds left; negative once in overtime
  past: boolean; // running && rest is up
  display: string; // "M:SS" remaining, "+M:SS" overtime, or the target when idle
  start: () => void;
  reset: () => void;
} {
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const startedAt = useRef<number | null>(null);

  const start = () => { startedAt.current = Date.now(); setElapsed(0); setRunning(true); };
  const reset = () => { setRunning(false); startedAt.current = null; setElapsed(0); };

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      if (startedAt.current != null) setElapsed(Math.floor((Date.now() - startedAt.current) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [running]);

  const remaining = targetSec - elapsed;
  const past = running && remaining <= 0;
  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  const display = !running ? fmt(targetSec) : remaining >= 0 ? fmt(remaining) : `+${fmt(-remaining)}`;

  return { running, remaining, past, display, start, reset };
}
