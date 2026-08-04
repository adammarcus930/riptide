export type MuscleGroup =
  | 'chest' | 'lats' | 'frontDelts' | 'sideDelts' | 'rearDelts' | 'traps'
  | 'quads' | 'hamstrings' | 'calves' | 'triceps' | 'biceps' | 'forearms' | 'abs';

// Swift CaseIterable declaration order.
export const ALL_MUSCLES: MuscleGroup[] = [
  'chest', 'lats', 'frontDelts', 'sideDelts', 'rearDelts', 'traps',
  'quads', 'hamstrings', 'calves', 'triceps', 'biceps', 'forearms', 'abs',
];

// Allocated first; their exercises grant secondary credit.
export const GIVERS: MuscleGroup[] = [
  'chest', 'lats', 'frontDelts', 'sideDelts', 'rearDelts', 'traps', 'quads', 'hamstrings', 'calves',
];
// Allocated second; direct targets reduced by earned credits.
export const RECEIVERS: MuscleGroup[] = ['triceps', 'biceps', 'forearms', 'abs'];
// Generator processing order (spec §5 step 2).
export const PROCESSING_ORDER: MuscleGroup[] = [...GIVERS, ...RECEIVERS];
// Wizard chips and within-day lift ordering (design PARTS order).
export const DISPLAY_ORDER: MuscleGroup[] = [
  'quads', 'hamstrings', 'chest', 'lats', 'frontDelts', 'sideDelts', 'rearDelts',
  'traps', 'triceps', 'biceps', 'forearms', 'calves', 'abs',
];

export function muscleLabel(m: MuscleGroup): string {
  switch (m) {
    case 'frontDelts': return 'Front Delts';
    case 'sideDelts': return 'Side Delts';
    case 'rearDelts': return 'Rear Delts';
    default: return m.charAt(0).toUpperCase() + m.slice(1);
  }
}
