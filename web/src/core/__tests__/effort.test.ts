import { test, expect } from 'vitest';
import { allowedDays, effortLabel } from '../effort';

test('allowed days per effort match the Swift ranges', () => {
  expect(allowedDays('minimal')).toEqual([2, 3, 4, 5, 6, 7]);
  expect(allowedDays('optimal')).toEqual([4, 5, 6, 7]);
  expect(allowedDays('maximal')).toEqual([5, 6, 7]);
});

test('effort labels capitalize', () => {
  expect(effortLabel('optimal')).toBe('Optimal');
});
