import { test, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRestTimer } from './useRestTimer';

afterEach(() => vi.useRealTimers());

test('idle shows the target; counts down; flips past into overtime', () => {
  vi.useFakeTimers();
  const { result } = renderHook(() => useRestTimer(3)); // 3s target
  expect(result.current.running).toBe(false);
  expect(result.current.display).toBe('0:03'); // idle = target ("ready")

  act(() => result.current.start());
  expect(result.current.running).toBe(true);
  expect(result.current.display).toBe('0:03'); // full remaining at start
  expect(result.current.past).toBe(false);

  act(() => vi.advanceTimersByTime(1000));
  expect(result.current.remaining).toBe(2);
  expect(result.current.display).toBe('0:02');
  expect(result.current.past).toBe(false);

  act(() => vi.advanceTimersByTime(2000)); // total 3s → remaining 0
  expect(result.current.past).toBe(true);
  expect(result.current.display).toBe('0:00');

  act(() => vi.advanceTimersByTime(2000)); // total 5s → remaining -2 (overtime)
  expect(result.current.past).toBe(true);
  expect(result.current.display).toBe('+0:02');
});

test('reset returns to idle showing the target', () => {
  vi.useFakeTimers();
  const { result } = renderHook(() => useRestTimer(90)); // 1:30 target
  act(() => result.current.start());
  act(() => vi.advanceTimersByTime(5000));
  act(() => result.current.reset());
  expect(result.current.running).toBe(false);
  expect(result.current.display).toBe('1:30');
  expect(result.current.past).toBe(false);
});
