import { test, expect } from 'vitest';
import { ExerciseBank } from '../exercise';
import { ALL_MUSCLES } from '../muscleGroup';

test('bank loads and is well-formed', () => {
  const all = ExerciseBank.all;
  expect(all.length).toBeGreaterThanOrEqual(40);
  expect(new Set(all.map((e) => e.id)).size).toBe(all.length);
  for (const ex of all) {
    expect(ex.secondaries).not.toContain(ex.primary);
    expect(ex.name.length).toBeGreaterThan(0);
    expect(ex.repRange.length).toBeGreaterThan(0);
  }
});

test('every muscle has at least two exercises', () => {
  for (const m of ALL_MUSCLES) {
    expect(ExerciseBank.exercisesFor(m).length).toBeGreaterThanOrEqual(2);
  }
});

test('secondaries follow the obvious-only rule (spec §6)', () => {
  expect(ExerciseBank.find('bench-press')?.secondaries).toEqual(['triceps']);
  expect(ExerciseBank.find('pull-up')?.secondaries).toEqual(['biceps']);
  expect(ExerciseBank.find('overhead-press')?.secondaries).toEqual(['triceps']);
  expect(ExerciseBank.find('back-squat')?.secondaries).toEqual([]);
  expect(ExerciseBank.find('romanian-deadlift')?.secondaries).toEqual([]);
});
