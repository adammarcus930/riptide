// @vitest-environment node
import { test, expect } from 'vitest';
import { pwaOptions } from '../vite.config';

test('manifest is standalone with ice-palette colors and three icons', () => {
  expect(pwaOptions.manifest.name).toBe('Riptide');
  expect(pwaOptions.manifest.display).toBe('standalone');
  expect(pwaOptions.manifest.theme_color).toBe('#0D1013');
  expect(pwaOptions.manifest.icons).toHaveLength(3);
  expect(pwaOptions.manifest.icons.some((i) => i.purpose === 'maskable')).toBe(true);
});