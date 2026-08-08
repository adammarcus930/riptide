import type { SVGProps } from 'react';

// Shared icon set: 24px grid, 2px rounded strokes, currentColor — replaces the
// text glyphs (☑ ○ ‹ ↑ ✕ …) that rendered inconsistently and read as placeholder.
type IconProps = SVGProps<SVGSVGElement>;

function Base({ children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export const IconChevronLeft = (p: IconProps) => (
  <Base {...p}><path d="M15 18l-6-6 6-6" /></Base>
);
export const IconChevronRight = (p: IconProps) => (
  <Base {...p}><path d="M9 6l6 6-6 6" /></Base>
);
export const IconCircle = (p: IconProps) => (
  <Base {...p}><circle cx="12" cy="12" r="9" /></Base>
);
export const IconCheckCircle = (p: IconProps) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="10" fill="currentColor" stroke="none" />
    <path d="M8 12.5l2.7 2.7L16.5 9" stroke="#04141D" strokeWidth={2.4} />
  </Base>
);
export const IconSquare = (p: IconProps) => (
  <Base {...p}><rect x="4" y="4" width="16" height="16" rx="5" /></Base>
);
export const IconCheckSquare = (p: IconProps) => (
  <Base {...p}>
    <rect x="3.5" y="3.5" width="17" height="17" rx="5" fill="currentColor" stroke="none" />
    <path d="M8 12.5l2.7 2.7L16.5 9" stroke="#04141D" strokeWidth={2.4} />
  </Base>
);
export const IconArrowUp = (p: IconProps) => (
  <Base {...p}><path d="M12 19V5M5 12l7-7 7 7" /></Base>
);
export const IconArrowDown = (p: IconProps) => (
  <Base {...p}><path d="M12 5v14M19 12l-7 7-7-7" /></Base>
);
export const IconX = (p: IconProps) => (
  <Base {...p}><path d="M18 6L6 18M6 6l12 12" /></Base>
);
export const IconPlus = (p: IconProps) => (
  <Base {...p}><path d="M12 5v14M5 12h14" /></Base>
);
export const IconMinus = (p: IconProps) => (
  <Base {...p}><path d="M5 12h14" /></Base>
);
export const IconPencil = (p: IconProps) => (
  <Base {...p}><path d="M17 3a2.828 2.828 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z" /></Base>
);
export const IconBolt = (p: IconProps) => (
  <Base {...p}><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" fill="currentColor" stroke="none" /></Base>
);
export const IconList = (p: IconProps) => (
  <Base {...p}><path d="M8 6h13M8 12h13M8 18h13" /><path d="M3 6h.01M3 12h.01M3 18h.01" strokeWidth={2.6} /></Base>
);
export const IconMore = (p: IconProps) => (
  <Base {...p}>
    <circle cx="5" cy="12" r="1.6" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
    <circle cx="19" cy="12" r="1.6" fill="currentColor" stroke="none" />
  </Base>
);
