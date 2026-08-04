// Copies the canonical exercises.json (the Swift resource) into the web engine.
// Run via `npm --prefix web run sync:shared` whenever the canonical file changes.
// The sharedContract test fails if the committed copy drifts from canonical.
import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url)); // web/scripts
const repoRoot = resolve(here, '../..');              // -> repo root
const src = resolve(repoRoot, 'RiptideCore/Sources/RiptideCore/Resources/exercises.json');
const dest = resolve(here, '../src/core/data/exercises.json');

mkdirSync(dirname(dest), { recursive: true });
copyFileSync(src, dest);
console.log(`synced ${src} -> ${dest}`);
