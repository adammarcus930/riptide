import type { ReactNode } from 'react';

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-card border border-stroke bg-card p-4 ${className}`}>{children}</div>
  );
}
