import { test, expect } from 'vitest';
import { weeklyTarget, entrySizes, dayLoads, spreadDays } from '../allocation';

test('weekly target is the midpoint, floored at 2, else 0', () => {
  expect(weeklyTarget({ low: 10, high: 14 })).toBe(12);
  expect(weeklyTarget({ low: 12, high: 18 })).toBe(15);
  expect(weeklyTarget({ low: 8, high: 12 })).toBe(10);
  expect(weeklyTarget({ low: 0, high: 3 })).toBe(2);
  expect(weeklyTarget({ low: 0, high: 1 })).toBe(0);
});

test('entry sizes prefer 3s, then split, then 4s; always 2-4', () => {
  expect(entrySizes(2, 1)).toEqual([2]);
  expect(entrySizes(3, 1)).toEqual([3]);
  expect(entrySizes(4, 2)).toEqual([2, 2]);
  expect(entrySizes(4, 1)).toEqual([4]);
  expect(entrySizes(5, 2)).toEqual([3, 2]);
  expect(entrySizes(6, 2)).toEqual([3, 3]);
  expect(entrySizes(7, 3)).toEqual([3, 2, 2]);
  expect(entrySizes(8, 2)).toEqual([4, 4]);
  for (let sets = 2; sets <= 16; sets++) {
    const maxE = Math.ceil(sets / 4);
    for (let m = maxE; m <= 5; m++) {
      const sizes = entrySizes(sets, m);
      expect(sizes.reduce((s, v) => s + v, 0)).toBe(sets);
      expect(sizes.every((v) => v >= 2 && v <= 4)).toBe(true);
      expect(sizes.length).toBeLessThanOrEqual(m);
    }
  }
});

test('day loads concentrate at ~3 sets, respecting the per-day cap', () => {
  expect(dayLoads(12, 4, 2)).toEqual([3, 3, 3, 3]);
  expect(dayLoads(14, 4, 1)).toEqual([4, 4, 3, 3]);
  expect(dayLoads(28, 5, 2)).toEqual([6, 6, 6, 5, 5]);
  expect(dayLoads(2, 7, 3)).toEqual([2]);
  expect(dayLoads(0, 4, 2)).toEqual([]);
  // Concentration: fewer days at 3 rather than thin spread.
  expect(dayLoads(12, 6, 2)).toEqual([3, 3, 3, 3]);
  expect(dayLoads(6, 6, 2)).toEqual([3, 3]);
  expect(dayLoads(9, 7, 2)).toEqual([3, 3, 3]);
  for (let total = 2; total <= 24; total++) {
    const loads = dayLoads(total, 7, 3);
    expect(loads.reduce((s, v) => s + v, 0)).toBe(total);
    expect(loads.every((v) => v >= 2)).toBe(true);
  }
});

test('spread days is even and non-contiguous', () => {
  expect([...spreadDays(4, 6, 0)].sort((a, b) => a - b)).toEqual([0, 2, 3, 5]);
  expect([...spreadDays(4, 7, 0)].sort((a, b) => a - b)).toEqual([0, 2, 4, 6]);
  expect([...spreadDays(2, 6, 0)].sort((a, b) => a - b)).toEqual([1, 4]);
  expect(spreadDays(6, 6, 3)).toEqual([0, 1, 2, 3, 4, 5]);
  for (let days = 2; days <= 7; days++) {
    for (let k = 1; k < days; k++) {
      for (let phase = 0; phase < days; phase++) {
        const s = spreadDays(k, days, phase);
        expect(new Set(s).size).toBe(k);
        expect(s.every((d) => d >= 0 && d < days)).toBe(true);
        if (k >= 2) {
          const sorted = [...s].sort((a, b) => a - b);
          const gaps: number[] = [];
          for (let i = 1; i < sorted.length; i++) gaps.push(sorted[i] - sorted[i - 1]);
          gaps.push(sorted[0] + days - sorted[sorted.length - 1]);
          expect(Math.max(...gaps) - Math.min(...gaps)).toBeLessThanOrEqual(1);
        }
      }
    }
  }
});
