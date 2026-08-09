import { WaveMark } from './WaveMark';

// The brand lockup: wave mark + tracked wordmark. Compact for headers.
export function Brand({ compact = false }: { compact?: boolean }) {
  return compact ? (
    <div className="flex items-center gap-2">
      <WaveMark className="h-4 w-7 text-accent" />
      <span className="text-[11px] font-extrabold tracking-[3px] text-ink">RIPTIDE</span>
    </div>
  ) : (
    <div className="flex flex-col items-start gap-2">
      <WaveMark className="h-9 w-14 text-accent" />
      <span className="text-[15px] font-extrabold tracking-[4px] text-ink">RIPTIDE</span>
    </div>
  );
}
