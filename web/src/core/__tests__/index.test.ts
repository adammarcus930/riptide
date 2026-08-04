import { test, expect } from 'vitest';
import * as core from '../index';

test('barrel exposes the public engine surface', () => {
  expect(typeof core.generate).toBe('function');
  expect(typeof core.table).toBe('function');
  expect(typeof core.weeklyRange).toBe('function');
  expect(core.ExerciseBank.all.length).toBeGreaterThanOrEqual(40);
  expect(core.ALL_MUSCLES.length).toBe(13);
});
