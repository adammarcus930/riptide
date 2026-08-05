import type { ReactNode } from 'react';

export function Eyebrow({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <span className={`text-[11px] font-extrabold uppercase tracking-[1.5px] text-ink-faint ${className}`}>
      {children}
    </span>
  );
}
