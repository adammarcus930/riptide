import { test, expect } from 'vitest';
import { weeklyRange } from '../volumeTable';
import { ALL_MUSCLES } from '../muscleGroup';
import { ALL_EFFORTS } from '../effort';

test('spot-check ranges match the Swift table', () => {
  expect(weeklyRange('chest', 'optimal')).toEqual({ low: 10, high: 14 });
  expect(weeklyRange('frontDelts', 'minimal')).toEqual({ low: 0, high: 4 });
  expect(weeklyRange('frontDelts', 'maximal')).toEqual({ low: 10, high: 12 });
  expect(weeklyRange('sideDelts', 'minimal')).toEqual({ low: 6, high: 10 });
  expect(weeklyRange('sideDelts', 'maximal')).toEqual({ low: 20, high: 26 });
  expect(weeklyRange('rearDelts', 'minimal')).toEqual({ low: 4, high: 8 });
  expect(weeklyRange('rearDelts', 'maximal')).toEqual({ low: 18, high: 24 });
  expect(weeklyRange('forearms', 'minimal')).toEqual({ low: 0, high: 3 });
  expect(weeklyRange('hamstrings', 'optimal')).toEqual({ low: 8, high: 12 });
});

test('every muscle has low <= high for every effort', () => {
  for (const m of ALL_MUSCLES) {
    for (const e of ALL_EFFORTS) {
      const rr = weeklyRange(m, e);
      expect(rr.low).toBeLessThanOrEqual(rr.high);
    }
  }
});
