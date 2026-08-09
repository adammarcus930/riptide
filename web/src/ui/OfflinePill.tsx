import { useEffect, useState } from 'react';

// Quiet trust signal: the app works offline (Firestore queues writes), but
// silence looks like failure — say so while it's happening.
export function OfflinePill() {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);
  if (online) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+8px)] z-50 flex justify-center">
      <div className="rounded-full border border-stroke-strong bg-input px-3 py-1.5 text-[11px] font-bold text-ink-dim">
        Offline — changes will sync
      </div>
    </div>
  );
}
