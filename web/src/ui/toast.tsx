import { useEffect, useState } from 'react';

// Tiny module-level toast bus: data-layer catches call toast('…') without any
// context plumbing; the single <Toaster/> in App renders and auto-dismisses.
export interface ToastMsg { id: number; text: string }
type Listener = (t: ToastMsg) => void;

let nextId = 1;
const listeners = new Set<Listener>();

export function toast(text: string): void {
  const t = { id: nextId++, text };
  listeners.forEach((l) => l(t));
}

export function Toaster() {
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  useEffect(() => {
    const on: Listener = (t) => {
      setToasts((prev) => [...prev, t]);
      setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== t.id)), 3500);
    };
    listeners.add(on);
    return () => { listeners.delete(on); };
  }, []);
  if (toasts.length === 0) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex flex-col items-center gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="animate-pop rounded-full border border-stroke-strong bg-input px-4 py-2 text-[13px] font-bold text-ink shadow-cta"
        >
          {t.text}
        </div>
      ))}
    </div>
  );
}
