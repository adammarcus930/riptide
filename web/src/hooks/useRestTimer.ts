import { useEffect, useRef, useState } from 'react';

export function useRestTimer(alertSec: number): {
  elapsed: number;
  running: boolean;
  past: boolean;
  display: string;
  start: () => void;
  stop: () => void;
} {
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const startedAt = useRef<number | null>(null);

  const start = () => { startedAt.current = Date.now(); setElapsed(0); setRunning(true); };
  const stop = () => { setRunning(false); startedAt.current = null; };

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      if (startedAt.current != null) setElapsed(Math.floor((Date.now() - startedAt.current) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [running]);

  const past = running && elapsed >= alertSec;
  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const ss = String(elapsed % 60).padStart(2, '0');
  return { elapsed, running, past, display: `${mm}:${ss}`, start, stop };
}
