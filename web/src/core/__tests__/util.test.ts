import { test, expect } from 'vitest';
import { idiv, roundHalf, ceilDiv, assert } from '../util';

test('idiv truncates toward zero', () => {
  expect(idiv(7, 2)).toBe(3);
  expect(idiv(-7, 2)).toBe(-3);
  expect(idiv(6, 3)).toBe(2);
});

test('roundHalf rounds half away from zero', () => {
  expect(roundHalf(2.5)).toBe(3);
  expect(roundHalf(3.5)).toBe(4);
  expect(roundHalf(-2.5)).toBe(-3);
  expect(roundHalf(0.4)).toBe(0);
  expect(roundHalf(0.6)).toBe(1);
});

test('ceilDiv rounds up', () => {
  expect(ceilDiv(7, 3)).toBe(3);
  expect(ceilDiv(6, 3)).toBe(2);
  expect(ceilDiv(1, 4)).toBe(1);
});

test('assert does not throw when true, throws with message when false', () => {
  expect(() => assert(true, 'should not throw')).not.toThrow();
  expect(() => assert(false, 'msg')).toThrow('msg');
});
