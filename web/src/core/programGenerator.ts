import type { Effort } from './effort';
import { allowedDays } from './effort';
import type { MuscleGroup } from './muscleGroup';
import { PROCESSING_ORDER, RECEIVERS, DISPLAY_ORDER } from './muscleGroup';
import type { ExerciseDefinition } from './exercise';
import { weeklyRange } from './volumeTable';
import { weeklyTarget, dayLoads, spreadDays, entrySizes } from './allocation';
import { idiv, assert } from './util';

export interface GeneratorInput {
  effort: Effort;
  days: number;
  // Ordered as the user picked them; every present muscle has >= 1 exercise.
  selections: Map<MuscleGroup, ExerciseDefinition[]>;
}
export interface GeneratedLift {
  exercise: ExerciseDefinition;
  sets: number;
}
export interface GeneratedDay {
  lifts: GeneratedLift[];
}
export interface GeneratedProgram {
  days: GeneratedDay[];
}

// Deterministic, total over wizard-valid input (spec §5). Never throws for valid input.
export function generate(input: GeneratorInput): GeneratedProgram {
  assert(allowedDays(input.effort).includes(input.days), 'wizard gates day counts');

  const selected = PROCESSING_ORDER.filter((m) => (input.selections.get(m) ?? []).length > 0);
  const dayLifts: GeneratedLift[][] = Array.from({ length: input.days }, () => []);
  const dayTotals: number[] = new Array(input.days).fill(0);
  const secondarySets = new Map<MuscleGroup, number>();

  for (const muscle of selected) {
    const exercises = input.selections.get(muscle)!;
    const range = weeklyRange(muscle, input.effort);
    let target = weeklyTarget(range);

    // Spec §5.2: receivers get 0.5 credit per secondary set. Aim at midpoint - credit,
    // but guarantee >= 2 direct sets whenever there's still room under the range top.
    if (RECEIVERS.includes(muscle)) {
      const credit = idiv(secondarySets.get(muscle) ?? 0, 2);
      const aim = Math.max(0, target - credit);
      const headroom = Math.max(0, range.high - credit);
      target = Math.max(aim, headroom >= 2 ? 2 : 0);
    }
    if (target < 2) continue;

    // Spec §5.6 ladder step 4: clamp to capacity.
    const capacity = input.days * exercises.length * 4;
    const achieved = Math.min(target, capacity);
    if (achieved < 2) continue;

    const loads = dayLoads(achieved, input.days, exercises.length);
    const k = loads.length;

    // Spread this muscle's sessions evenly; among equally-spread rotations, pick the
    // one that best levels running daily totals. Stable sort keeps spreadDays order on ties.
    let dayOrder = [...spreadDays(k, input.days, 0)].sort((a, b) => dayTotals[a] - dayTotals[b]);
    let bestScore = Number.MAX_SAFE_INTEGER;
    for (let phase = 0; phase < input.days; phase++) {
      const slots = [...spreadDays(k, input.days, phase)].sort((a, b) => dayTotals[a] - dayTotals[b]);
      const trial = [...dayTotals];
      loads.forEach((load, i) => {
        trial[slots[i]] += load;
      });
      const score = trial.reduce((s, v) => s + v * v, 0); // lower = more level
      if (score < bestScore) {
        bestScore = score;
        dayOrder = slots;
      }
    }

    let rotation = 0;
    loads.forEach((load, i) => {
      const d = dayOrder[i];
      for (const size of entrySizes(load, exercises.length)) {
        const ex = exercises[rotation % exercises.length];
        rotation += 1;
        dayLifts[d].push({ exercise: ex, sets: size });
        dayTotals[d] += size;
        for (const sec of ex.secondaries) {
          secondarySets.set(sec, (secondarySets.get(sec) ?? 0) + size);
        }
      }
    });
  }

  // Within-day ordering: compounds-first display order (spec §5.7). Stable sort keeps
  // insertion order for lifts with the same primary and name.
  const days: GeneratedDay[] = dayLifts.map((lifts) => ({
    lifts: [...lifts].sort((a, b) => {
      const ia = DISPLAY_ORDER.indexOf(a.exercise.primary);
      const ib = DISPLAY_ORDER.indexOf(b.exercise.primary);
      if (ia !== ib) return ia - ib;
      if (a.exercise.name < b.exercise.name) return -1;
      if (a.exercise.name > b.exercise.name) return 1;
      return 0;
    }),
  }));
  return { days };
}
