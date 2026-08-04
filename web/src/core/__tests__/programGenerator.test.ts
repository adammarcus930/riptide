import { test, expect } from 'vitest';
import { generate, type GeneratorInput } from '../programGenerator';
import { table } from '../programPrinter';
import { ALL_MUSCLES, type MuscleGroup } from '../muscleGroup';
import { ALL_EFFORTS, allowedDays, type Effort } from '../effort';
import { weeklyRange } from '../volumeTable';
import { weeklyTarget } from '../allocation';
import { ExerciseBank, type ExerciseDefinition } from '../exercise';

function fullInput(effort: Effort, days: number, perMuscle = 2): GeneratorInput {
  const sel = new Map<MuscleGroup, ExerciseDefinition[]>();
  for (const m of ALL_MUSCLES) sel.set(m, ExerciseBank.exercisesFor(m).slice(0, perMuscle));
  return { effort, days, selections: sel };
}
function selecting(muscle: MuscleGroup, exercises: ExerciseDefinition[], effort: Effort, days: number): GeneratorInput {
  const sel = new Map<MuscleGroup, ExerciseDefinition[]>();
  sel.set(muscle, exercises);
  return { effort, days, selections: sel };
}
const flat = (p: { days: { lifts: { exercise: ExerciseDefinition; sets: number }[] }[] }) =>
  p.days.flatMap((d) => d.lifts);

test('generation is deterministic', () => {
  const input = fullInput('optimal', 4);
  expect(table(generate(input))).toBe(table(generate(input)));
});

test('invariants hold across all efforts, day counts and exercise counts', () => {
  for (const effort of ALL_EFFORTS) {
    for (const days of allowedDays(effort)) {
      for (let perMuscle = 1; perMuscle <= 3; perMuscle++) {
        const input = fullInput(effort, days, perMuscle);
        const program = generate(input);
        expect(program.days.length).toBe(days);

        const weekly = new Map<MuscleGroup, number>();
        const secondary = new Map<MuscleGroup, number>();
        for (const day of program.days) {
          const seen = new Map<MuscleGroup, Set<string>>();
          for (const lift of day.lifts) {
            expect(lift.sets).toBeGreaterThanOrEqual(2);
            expect(lift.sets).toBeLessThanOrEqual(4);
            const set = seen.get(lift.exercise.primary) ?? new Set<string>();
            expect(set.has(lift.exercise.id)).toBe(false);
            set.add(lift.exercise.id);
            seen.set(lift.exercise.primary, set);
            weekly.set(lift.exercise.primary, (weekly.get(lift.exercise.primary) ?? 0) + lift.sets);
            for (const sec of lift.exercise.secondaries) {
              secondary.set(sec, (secondary.get(sec) ?? 0) + lift.sets);
            }
          }
        }
        for (const m of ALL_MUSCLES) {
          const range = weeklyRange(m, effort);
          if (range.high < 2) continue;
          const direct = weekly.get(m) ?? 0;
          const credit = Math.trunc((secondary.get(m) ?? 0) / 2);
          if ((input.selections.get(m) ?? []).length > 0) {
            expect(direct + credit).toBeGreaterThanOrEqual(range.low);
          }
          expect(direct).toBeLessThanOrEqual(range.high);
        }
        const totals = program.days.map((d) => d.lifts.reduce((s, l) => s + l.sets, 0));
        expect(Math.max(...totals) - Math.min(...totals)).toBeLessThanOrEqual(8);
      }
    }
  }
});

test('rotation covers every chosen exercise', () => {
  const program = generate(fullInput('optimal', 5, 3));
  const chest = new Set(flat(program).filter((l) => l.exercise.primary === 'chest').map((l) => l.exercise.id));
  expect(chest.size).toBe(3);
});

test('secondary credits reduce direct receiver work', () => {
  const program = generate(fullInput('optimal', 4, 2));
  const directTriceps = flat(program).filter((l) => l.exercise.primary === 'triceps').reduce((s, l) => s + l.sets, 0);
  const rawTarget = weeklyTarget(weeklyRange('triceps', 'optimal'));
  expect(directTriceps).toBeLessThan(rawTarget);
});

test('selected receiver still gets some direct work despite heavy credit', () => {
  const program = generate(fullInput('optimal', 4, 2));
  for (const muscle of ['triceps', 'biceps'] as MuscleGroup[]) {
    const direct = flat(program).filter((l) => l.exercise.primary === muscle).reduce((s, l) => s + l.sets, 0);
    expect(direct).toBeGreaterThanOrEqual(2);
    const secondary = flat(program).filter((l) => l.exercise.secondaries.includes(muscle)).reduce((s, l) => s + l.sets, 0);
    const range = weeklyRange(muscle, 'optimal');
    expect(direct + Math.trunc(secondary / 2)).toBeLessThanOrEqual(range.high + 1);
  }
});

test('single-exercise selection never shortfalls (corrected table)', () => {
  const program = generate(selecting('sideDelts', [ExerciseBank.find('db-lateral-raise')!], 'minimal', 2));
  const total = flat(program).reduce((s, l) => s + l.sets, 0);
  expect(total).toBeGreaterThanOrEqual(weeklyRange('sideDelts', 'minimal').low);
});

test('capacity clamps exactly to the low end without shortfall', () => {
  const program = generate(selecting('sideDelts', [ExerciseBank.find('db-lateral-raise')!], 'maximal', 5));
  const total = flat(program).reduce((s, l) => s + l.sets, 0);
  const range = weeklyRange('sideDelts', 'maximal');
  expect(total).toBe(20);
  expect(total).toBe(range.low);
  expect(weeklyTarget(range)).toBeGreaterThan(total);
});

test('exhaustive sweep finds no reachable shortfall', () => {
  for (const muscle of ALL_MUSCLES) {
    const available = ExerciseBank.exercisesFor(muscle);
    if (available.length === 0) continue;
    for (const effort of ALL_EFFORTS) {
      const range = weeklyRange(muscle, effort);
      if (range.high < 2) continue;
      for (const days of allowedDays(effort)) {
        for (let exerciseCount = 1; exerciseCount <= 3; exerciseCount++) {
          const capacity = days * exerciseCount * 4;
          expect(capacity).toBeGreaterThanOrEqual(range.low);
          const program = generate(selecting(muscle, available.slice(0, exerciseCount), effort, days));
          const total = program.days.flatMap((d) => d.lifts).reduce((s, l) => s + l.sets, 0);
          expect(total).toBeGreaterThanOrEqual(range.low);
        }
      }
    }
  }
});

test('unselected muscles are absent', () => {
  const program = generate(selecting('chest', ExerciseBank.exercisesFor('chest').slice(0, 2), 'optimal', 4));
  expect(flat(program).every((l) => l.exercise.primary === 'chest')).toBe(true);
});
