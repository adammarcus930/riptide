import { test, expect } from 'vitest';
import { materialize, toGeneratorInput, dayFocus, type NewProgramInput } from '../materialize';
import { generate, ExerciseBank, ALL_MUSCLES, type MuscleGroup, type ExerciseDefinition } from '../../core';

function fullInput(days: number, perMuscle: number): NewProgramInput {
  const selections = new Map<MuscleGroup, ExerciseDefinition[]>();
  for (const m of ALL_MUSCLES) selections.set(m, ExerciseBank.exercisesFor(m).slice(0, perMuscle));
  return { name: '4-Day Optimal', effort: 'optimal', days, selections };
}

test('materialize maps a generated program into a ProgramDoc', () => {
  const input = fullInput(4, 2);
  const doc = materialize(generate(toGeneratorInput(input)), input);
  expect(doc.name).toBe('4-Day Optimal');
  expect(doc.effort).toBe('optimal');
  expect(doc.daysPerWeek).toBe(4);
  expect(doc.isActive).toBe(true);
  expect(doc.days).toHaveLength(4);
  // muscles are in DISPLAY_ORDER and only selected ones (all selected here).
  expect(doc.muscles).toContain('chest');
  // day/lift indices and order are 0-based and sequential.
  doc.days.forEach((d, i) => {
    expect(d.index).toBe(i);
    expect(d.completedInCycle).toBe(false);
    d.lifts.forEach((l, j) => {
      expect(l.order).toBe(j);
      expect(l.exerciseId).toBeTruthy();
      expect(l.targetSets).toBeGreaterThanOrEqual(2);
    });
  });
});

test('materialize includes only selected muscles, in DISPLAY_ORDER', () => {
  const selections = new Map<MuscleGroup, ExerciseDefinition[]>();
  selections.set('chest', ExerciseBank.exercisesFor('chest').slice(0, 2));
  selections.set('quads', ExerciseBank.exercisesFor('quads').slice(0, 2));
  const input: NewProgramInput = { name: 'x', effort: 'optimal', days: 4, selections };
  const doc = materialize(generate(toGeneratorInput(input)), input);
  expect(doc.muscles).toEqual(['quads', 'chest']); // DISPLAY_ORDER puts quads before chest
});

test('dayFocus lists each muscle once, in lift order, joined by " · "', () => {
  expect(
    dayFocus([
      { order: 0, muscle: 'chest', exerciseId: 'a', exerciseName: 'A', repRange: '5-8', targetSets: 3 },
      { order: 1, muscle: 'chest', exerciseId: 'b', exerciseName: 'B', repRange: '5-8', targetSets: 3 },
      { order: 2, muscle: 'triceps', exerciseId: 'c', exerciseName: 'C', repRange: '10-15', targetSets: 2 },
    ]),
  ).toBe('Chest · Triceps');
  expect(dayFocus([])).toBe('');
});
