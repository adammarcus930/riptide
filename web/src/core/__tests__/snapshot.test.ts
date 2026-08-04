import { describe, test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generate, type GeneratorInput } from '../programGenerator';
import { table } from '../programPrinter';
import { ALL_MUSCLES, type MuscleGroup } from '../muscleGroup';
import type { Effort } from '../effort';
import { ExerciseBank, type ExerciseDefinition } from '../exercise';

const here = dirname(fileURLToPath(import.meta.url)); // web/src/core/__tests__
const snapDir = resolve(here, '../../../../RiptideCore/Tests/RiptideCoreTests/Snapshots');

function golden(name: string): string {
  return readFileSync(resolve(snapDir, `${name}.txt`), 'utf8');
}

// Mirrors the Swift SnapshotTests.input helper: every muscle, first `perMuscle`
// bank exercises each.
function input(effort: Effort, days: number, perMuscle: number): GeneratorInput {
  const sel = new Map<MuscleGroup, ExerciseDefinition[]>();
  for (const m of ALL_MUSCLES) sel.set(m, ExerciseBank.exercisesFor(m).slice(0, perMuscle));
  return { effort, days, selections: sel };
}

describe('snapshot parity vs Swift golden files', () => {
  test('optimal-4day-2ex', () => {
    expect(table(generate(input('optimal', 4, 2)))).toBe(golden('optimal-4day-2ex'));
  });
  test('minimal-2day-2ex', () => {
    expect(table(generate(input('minimal', 2, 2)))).toBe(golden('minimal-2day-2ex'));
  });
  test('maximal-7day-3ex', () => {
    expect(table(generate(input('maximal', 7, 3)))).toBe(golden('maximal-7day-3ex'));
  });
});
