import { test, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRestTimer } from './useRestTimer';

afterEach(() => vi.useRealTimers());

test('counts up, formats mm:ss, and flips past at alertSec', () => {
  vi.useFakeTimers();
  const { result } = renderHook(() => useRestTimer(3));
  expect(result.current.running).toBe(false);
  act(() => result.current.start());
  expect(result.current.running).toBe(true);
  act(() => vi.advanceTimersByTime(2000));
  expect(result.current.elapsed).toBe(2);
  expect(result.current.past).toBe(false);
  expect(result.current.display).toBe('00:02');
  act(() => vi.advanceTimersByTime(2000));
  expect(result.current.elapsed).toBe(4);
  expect(result.current.past).toBe(true);
});

test('stop halts counting', () => {
  vi.useFakeTimers();
  const { result } = renderHook(() => useRestTimer(60));
  act(() => result.current.start());
  act(() => vi.advanceTimersByTime(1000));
  act(() => result.current.stop());
  const at = result.current.elapsed;
  act(() => vi.advanceTimersByTime(5000));
  expect(result.current.elapsed).toBe(at);
  expect(result.current.running).toBe(false);
});
