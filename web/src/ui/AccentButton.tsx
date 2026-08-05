import type { ReactNode } from 'react';

export function AccentButton({
  children,
  onClick,
  type = 'button',
}: {
  children: ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit';
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      className="w-full rounded-btn bg-accent py-4 text-[15px] font-extrabold text-on-accent active:scale-[0.98]"
    >
      {children}
    </button>
  );
}
