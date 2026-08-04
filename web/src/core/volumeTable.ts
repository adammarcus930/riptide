import type { MuscleGroup } from './muscleGroup';
import type { Effort } from './effort';

export interface SetRange {
  low: number;
  high: number;
}

export function r(low: number, high: number): SetRange {
  return { low, high };
}

// Weekly set range per muscle per effort (spec §4). Values copied verbatim from
// RiptideCore/Sources/RiptideCore/VolumeTable.swift.
const TABLE: Record<MuscleGroup, { minimal: SetRange; optimal: SetRange; maximal: SetRange }> = {
  chest:      { minimal: r(5, 8),  optimal: r(10, 14), maximal: r(15, 20) },
  lats:       { minimal: r(6, 9),  optimal: r(12, 16), maximal: r(17, 22) },
  frontDelts: { minimal: r(0, 4),  optimal: r(4, 8),   maximal: r(10, 12) },
  sideDelts:  { minimal: r(6, 10), optimal: r(12, 18), maximal: r(20, 26) },
  rearDelts:  { minimal: r(4, 8),  optimal: r(10, 16), maximal: r(18, 24) },
  traps:      { minimal: r(4, 8),  optimal: r(10, 16), maximal: r(17, 24) },
  quads:      { minimal: r(4, 8),  optimal: r(9, 14),  maximal: r(15, 20) },
  hamstrings: { minimal: r(4, 6),  optimal: r(8, 12),  maximal: r(13, 18) },
  calves:     { minimal: r(5, 8),  optimal: r(10, 16), maximal: r(18, 24) },
  triceps:    { minimal: r(4, 8),  optimal: r(10, 14), maximal: r(16, 20) },
  biceps:     { minimal: r(4, 8),  optimal: r(10, 14), maximal: r(16, 20) },
  forearms:   { minimal: r(0, 3),  optimal: r(4, 8),   maximal: r(10, 14) },
  abs:        { minimal: r(3, 6),  optimal: r(6, 12),  maximal: r(14, 18) },
};

export function weeklyRange(muscle: MuscleGroup, effort: Effort): SetRange {
  return TABLE[muscle][effort];
}
