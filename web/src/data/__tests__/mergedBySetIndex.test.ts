import { test, expect } from 'vitest';
import { mergedBySetIndex } from '../workouts';

test('current values win per setIndex; previous fills the gaps', () => {
  const previous = [
    { setIndex: 0, weight: 100, reps: 5 },
    { setIndex: 1, weight: 100, reps: 5 },
    { setIndex: 2, weight: 100, reps: 5 },
  ];
  const current = [{ setIndex: 1, weight: 110, reps: 4 }];
  const m = mergedBySetIndex(current, previous);
  expect(m.get(0)).toEqual({ weight: 100, reps: 5 });
  expect(m.get(1)).toEqual({ weight: 110, reps: 4 }); // current wins
  expect(m.get(2)).toEqual({ weight: 100, reps: 5 });
});
