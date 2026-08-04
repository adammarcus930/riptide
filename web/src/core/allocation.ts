import type { SetRange } from './volumeTable';
import { idiv, roundHalf, ceilDiv, assert } from './util';

// Spec §5.1: weekly set target is the midpoint of the effort range, floored at 2.
// Returns 0 when the range can't support the 2-set minimum.
export function weeklyTarget(range: SetRange): number {
  if (range.high < 2) return 0;
  return Math.max(2, idiv(range.low + range.high, 2));
}

// Split one day's sets for one muscle into lift entries of 2-4 sets (spec §5.6):
// prefer 3s, then split across more exercises, then 4-set entries.
export function entrySizes(sets: number, maxEntries: number): number[] {
  assert(sets >= 2 && sets <= maxEntries * 4, 'caller must clamp to capacity');
  let count = ceilDiv(sets, 3);
  if (count > maxEntries) count = ceilDiv(sets, 4);
  const base = idiv(sets, count);
  const rem = sets % count;
  return Array.from({ length: count }, (_, i) => (i < rem ? base + 1 : base));
}

// How many days a muscle appears on and how many sets each such day carries.
// Concentrates at ~3 sets/appearance (spec §5.5); raises k so no day exceeds cap.
export function dayLoads(total: number, days: number, maxEntriesPerDay: number): number[] {
  if (total < 2) return [];
  const dailyCap = maxEntriesPerDay * 4;
  let k = Math.max(1, roundHalf(total / 3));
  k = Math.min(k, days);
  k = Math.max(k, ceilDiv(total, dailyCap));
  assert(k <= days, 'caller must clamp total to days * dailyCap');
  const base = idiv(total, k);
  const rem = total % k;
  return Array.from({ length: k }, (_, i) => (i < rem ? base + 1 : base));
}

// Choose k day indices spread evenly across `days`, starting from `phase` (spec §5.5).
export function spreadDays(k: number, days: number, phase: number): number[] {
  if (k <= 0 || days <= 0) return [];
  if (k >= days) return Array.from({ length: days }, (_, i) => i);
  return Array.from({ length: k }, (_, i) => (phase + idiv((2 * i + 1) * days, 2 * k)) % days);
}
