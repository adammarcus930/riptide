import { test, expect, vi } from 'vitest';

// Emulator mode so no real config is required and no network is touched.
vi.stubEnv('VITE_USE_EMULATOR', '1');

test('firebase module initializes singletons without throwing', async () => {
  const mod = await import('./firebase');
  expect(mod.app).toBeTruthy();
  expect(mod.auth).toBeTruthy();
  expect(mod.db).toBeTruthy();
});
