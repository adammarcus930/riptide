import { test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url)); // web/src/core/__tests__
const canonical = resolve(here, '../../../../RiptideCore/Sources/RiptideCore/Resources/exercises.json');
const webCopy = resolve(here, '../data/exercises.json');

test('web exercises.json is byte-identical to the canonical Swift resource', () => {
  expect(readFileSync(webCopy, 'utf8')).toBe(readFileSync(canonical, 'utf8'));
});
