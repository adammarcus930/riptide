import { expect, test } from 'vitest';
import { generate, ExerciseBank, type MuscleGroup, type ExerciseDefinition } from '../index';

const selections = new Map<MuscleGroup, ExerciseDefinition[]>(
  (['chest', 'lats', 'quads', 'triceps'] as MuscleGroup[]).map(m => [m, [ExerciseBank.exercisesFor(m)[0]]]),
);
const volume = (p: ReturnType<typeof generate>, m: MuscleGroup) => p.days.flatMap(d => d.lifts).filter(l => l.exercise.primary === m).reduce((s, l) => s + l.sets, 0);

test('mixed effort uses independent targets and ignores skipped selections', () => {
  const p = generate({ days: 6, muscleEfforts: { chest: 'optimal', lats: 'maximal', quads: 'minimal' }, selections });
  expect(volume(p, 'chest')).toBe(12);
  expect(volume(p, 'lats')).toBe(19);
  expect(volume(p, 'quads')).toBe(6);
  expect(volume(p, 'triceps')).toBe(0);
});

test('two days permits maximal effort and reports actual capacity shortfall', () => {
  const p = generate({ days: 2, muscleEfforts: { chest: 'maximal' }, selections });
  expect(volume(p, 'chest')).toBe(8);
  expect(p.shortfalls).toEqual([{ muscle: 'chest', target: 17, achieved: 8 }]);
});

test('legacy effort matches explicit uniform levels', () => {
  const old = generate({ days: 6, effort: 'optimal', selections });
  const updated = generate({ days: 6, muscleEfforts: { chest: 'optimal', lats: 'optimal', quads: 'optimal', triceps: 'optimal' }, selections });
  expect(updated).toEqual(old);
});

test('secondary credit uses the receiving muscle own effort', () => {
  const p = generate({ days: 6, muscleEfforts: { chest: 'maximal', triceps: 'minimal' }, selections });
  expect(volume(p, 'chest')).toBe(17);
  expect(volume(p, 'triceps')).toBe(0);
});
