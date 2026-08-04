import { test, expect } from 'vitest';
import {
  ALL_MUSCLES, GIVERS, RECEIVERS, PROCESSING_ORDER, DISPLAY_ORDER, muscleLabel,
} from '../muscleGroup';

test('processing order is givers then receivers', () => {
  expect([...GIVERS, ...RECEIVERS]).toEqual(PROCESSING_ORDER);
});

test('display order covers every muscle exactly once', () => {
  expect(new Set(DISPLAY_ORDER)).toEqual(new Set(ALL_MUSCLES));
  expect(DISPLAY_ORDER.length).toBe(13);
});

test('delt labels are spaced, others capitalized', () => {
  expect(muscleLabel('frontDelts')).toBe('Front Delts');
  expect(muscleLabel('sideDelts')).toBe('Side Delts');
  expect(muscleLabel('rearDelts')).toBe('Rear Delts');
  expect(muscleLabel('chest')).toBe('Chest');
  expect(muscleLabel('hamstrings')).toBe('Hamstrings');
});
