# Riptide PWA — Plan 1: Core Engine Port Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the pure-Swift `RiptideCore` program-generation engine to an isolated, dependency-free TypeScript module under `web/`, with the full test suite and snapshot golden-file parity proving byte-identical output to the Swift engine.

**Architecture:** A standalone TypeScript library at `web/src/core/` mirroring the Swift `RiptideCore` package one file at a time. It imports nothing from React or Firebase. Determinism-critical arithmetic (integer division, half-away rounding, stable sorts) is reproduced exactly via small helpers so the generator produces identical programs. Correctness is gated by porting every Swift unit test plus a snapshot test that reads the committed Swift golden files directly and asserts equality.

**Tech Stack:** TypeScript 5.6 (strict, ESM), Vitest 2 (Node), npm. No runtime dependencies.

## Global Constraints

- **Node 20+**, package manager **npm**. All commands use `npm --prefix web …` (never `cd`).
- The `web/` package is **ESM** (`"type": "module"` in `package.json`).
- The engine (`web/src/core/**`) is **dependency-free**: it must NOT import React, Firebase, or any runtime dependency. Only relative imports within `core/` and Node built-ins (in tests/scripts only).
- **TypeScript strict mode** on; `tsc --noEmit` must pass.
- **Byte-identical snapshot parity** with the Swift engine is the primary correctness gate. Preserve the em-dash `—` (U+2014) in the printer and the en-dash `–` (U+2013) that lives inside rep-range strings — never substitute ASCII hyphens.
- **Determinism helpers are mandatory** (Task 4's `util.ts`): Swift `Int` division truncates toward zero → `idiv`; Swift `Double.rounded()` is round-half-away-from-zero → `roundHalf`; `.rounded(.up)` → `ceilDiv`. All operands in this engine are non-negative.
- **Stable sort reliance:** Node 20's `Array.prototype.sort` is stable. Comparators MUST return a number (`a - b`) and return `0` for ties so tie order is preserved — the Swift engine depends on stable sorts.
- `exercises.json` is the shared source of truth; the web copy is synced from the Swift resource and guarded by a contract test (Task 5). Snapshot golden files are read directly from the Swift test tree (Task 7) — never copied.
- MuscleGroup/Effort are string-literal unions whose values equal the Swift enum `rawValue`s exactly.

---

## File Structure

```
web/
  package.json                         # ESM package, npm scripts (Task 1)
  tsconfig.json                        # strict, resolveJsonModule (Task 1)
  vitest.config.ts                     # test include glob (Task 1)
  .gitignore                           # node_modules, coverage (Task 1)
  scripts/
    sync-shared.mjs                    # copy canonical exercises.json → web (Task 5)
  src/core/
    util.ts                            # idiv, roundHalf, ceilDiv, assert (Task 4)
    muscleGroup.ts                     # union + order arrays + labels (Task 2)
    effort.ts                          # union + allowedDays + label (Task 2)
    volumeTable.ts                     # SetRange + weeklyRange table (Task 3)
    exercise.ts                        # ExerciseDefinition + ExerciseBank (Task 5)
    data/exercises.json                # synced copy (Task 5)
    allocation.ts                      # weeklyTarget/entrySizes/dayLoads/spreadDays (Task 4)
    programGenerator.ts                # Generated* types + generate() (Task 6)
    programPrinter.ts                  # table() (Task 6)
    index.ts                           # public barrel (Task 8)
    __tests__/
      smoke.test.ts                    # Task 1 (removed in Task 8)
      muscleGroup.test.ts              # Task 2
      effort.test.ts                   # Task 2
      volumeTable.test.ts              # Task 3
      allocation.test.ts               # Task 4
      exercise.test.ts                 # Task 5
      sharedContract.test.ts           # Task 5
      programGenerator.test.ts         # Task 6
      snapshot.test.ts                 # Task 7
```

Canonical Swift artifacts referenced (never modified by this plan):
- `RiptideCore/Sources/RiptideCore/Resources/exercises.json`
- `RiptideCore/Tests/RiptideCoreTests/Snapshots/{optimal-4day-2ex,minimal-2day-2ex,maximal-7day-3ex}.txt`

---

### Task 1: Scaffold the `web/` engine project

**Files:**
- Create: `web/package.json`
- Create: `web/tsconfig.json`
- Create: `web/vitest.config.ts`
- Create: `web/.gitignore`
- Test: `web/src/core/__tests__/smoke.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: a working `npm --prefix web run test` (Vitest) and `npm --prefix web run typecheck` (tsc). Later tasks add source + tests to this package.

- [ ] **Step 1: Write `web/package.json`**

```json
{
  "name": "riptide-web",
  "private": true,
  "type": "module",
  "version": "0.0.0",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit",
    "sync:shared": "node scripts/sync-shared.mjs"
  },
  "devDependencies": {
    "@types/node": "^20.14.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: Write `web/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "resolveJsonModule": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "noEmit": true,
    "types": ["node"]
  },
  "include": ["src", "scripts"]
}
```

- [ ] **Step 3: Write `web/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
  },
});
```

- [ ] **Step 4: Write `web/.gitignore`**

```gitignore
node_modules/
coverage/
dist/
```

- [ ] **Step 5: Write the smoke test `web/src/core/__tests__/smoke.test.ts`**

```ts
import { test, expect } from 'vitest';

test('vitest runs', () => {
  expect(1 + 1).toBe(2);
});
```

- [ ] **Step 6: Install dependencies**

Run: `npm --prefix web install`
Expected: creates `web/node_modules` and `web/package-lock.json`, exits 0.

- [ ] **Step 7: Run the smoke test**

Run: `npm --prefix web run test`
Expected: PASS — 1 passed (`smoke.test.ts`).

- [ ] **Step 8: Verify typecheck passes**

Run: `npm --prefix web run typecheck`
Expected: no output, exit 0.

- [ ] **Step 9: Commit**

```bash
git add web/package.json web/package-lock.json web/tsconfig.json web/vitest.config.ts web/.gitignore web/src/core/__tests__/smoke.test.ts
git commit -m "chore(web): scaffold TypeScript engine package with Vitest"
```

---

### Task 2: MuscleGroup & Effort

**Files:**
- Create: `web/src/core/muscleGroup.ts`
- Create: `web/src/core/effort.ts`
- Test: `web/src/core/__tests__/muscleGroup.test.ts`
- Test: `web/src/core/__tests__/effort.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type MuscleGroup` (union of the 13 raw values), `ALL_MUSCLES`, `GIVERS`, `RECEIVERS`, `PROCESSING_ORDER`, `DISPLAY_ORDER: MuscleGroup[]`, `muscleLabel(m: MuscleGroup): string`.
  - `type Effort = 'minimal' | 'optimal' | 'maximal'`, `ALL_EFFORTS: Effort[]`, `allowedDays(e: Effort): number[]`, `effortLabel(e: Effort): string`.

- [ ] **Step 1: Write the failing tests `web/src/core/__tests__/muscleGroup.test.ts`**

```ts
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
```

- [ ] **Step 2: Write the failing tests `web/src/core/__tests__/effort.test.ts`**

```ts
import { test, expect } from 'vitest';
import { allowedDays, effortLabel } from '../effort';

test('allowed days per effort match the Swift ranges', () => {
  expect(allowedDays('minimal')).toEqual([2, 3, 4, 5, 6, 7]);
  expect(allowedDays('optimal')).toEqual([4, 5, 6, 7]);
  expect(allowedDays('maximal')).toEqual([5, 6, 7]);
});

test('effort labels capitalize', () => {
  expect(effortLabel('optimal')).toBe('Optimal');
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm --prefix web run test`
Expected: FAIL — cannot resolve `../muscleGroup` / `../effort`.

- [ ] **Step 4: Write `web/src/core/muscleGroup.ts`**

```ts
export type MuscleGroup =
  | 'chest' | 'lats' | 'frontDelts' | 'sideDelts' | 'rearDelts' | 'traps'
  | 'quads' | 'hamstrings' | 'calves' | 'triceps' | 'biceps' | 'forearms' | 'abs';

// Swift CaseIterable declaration order.
export const ALL_MUSCLES: MuscleGroup[] = [
  'chest', 'lats', 'frontDelts', 'sideDelts', 'rearDelts', 'traps',
  'quads', 'hamstrings', 'calves', 'triceps', 'biceps', 'forearms', 'abs',
];

// Allocated first; their exercises grant secondary credit.
export const GIVERS: MuscleGroup[] = [
  'chest', 'lats', 'frontDelts', 'sideDelts', 'rearDelts', 'traps', 'quads', 'hamstrings', 'calves',
];
// Allocated second; direct targets reduced by earned credits.
export const RECEIVERS: MuscleGroup[] = ['triceps', 'biceps', 'forearms', 'abs'];
// Generator processing order (spec §5 step 2).
export const PROCESSING_ORDER: MuscleGroup[] = [...GIVERS, ...RECEIVERS];
// Wizard chips and within-day lift ordering (design PARTS order).
export const DISPLAY_ORDER: MuscleGroup[] = [
  'quads', 'hamstrings', 'chest', 'lats', 'frontDelts', 'sideDelts', 'rearDelts',
  'traps', 'triceps', 'biceps', 'forearms', 'calves', 'abs',
];

export function muscleLabel(m: MuscleGroup): string {
  switch (m) {
    case 'frontDelts': return 'Front Delts';
    case 'sideDelts': return 'Side Delts';
    case 'rearDelts': return 'Rear Delts';
    default: return m.charAt(0).toUpperCase() + m.slice(1);
  }
}
```

- [ ] **Step 5: Write `web/src/core/effort.ts`**

```ts
export type Effort = 'minimal' | 'optimal' | 'maximal';

export const ALL_EFFORTS: Effort[] = ['minimal', 'optimal', 'maximal'];

export function allowedDays(e: Effort): number[] {
  switch (e) {
    case 'minimal': return [2, 3, 4, 5, 6, 7];
    case 'optimal': return [4, 5, 6, 7];
    case 'maximal': return [5, 6, 7];
  }
}

export function effortLabel(e: Effort): string {
  return e.charAt(0).toUpperCase() + e.slice(1);
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm --prefix web run test`
Expected: PASS — smoke + muscleGroup + effort tests green.

- [ ] **Step 7: Commit**

```bash
git add web/src/core/muscleGroup.ts web/src/core/effort.ts web/src/core/__tests__/muscleGroup.test.ts web/src/core/__tests__/effort.test.ts
git commit -m "feat(core): port MuscleGroup and Effort"
```

---

### Task 3: VolumeTable

**Files:**
- Create: `web/src/core/volumeTable.ts`
- Test: `web/src/core/__tests__/volumeTable.test.ts`

**Interfaces:**
- Consumes: `MuscleGroup`, `ALL_MUSCLES` (Task 2); `Effort`, `ALL_EFFORTS` (Task 2).
- Produces: `interface SetRange { low: number; high: number }`, `r(low, high): SetRange` helper, `weeklyRange(muscle: MuscleGroup, effort: Effort): SetRange`.

- [ ] **Step 1: Write the failing test `web/src/core/__tests__/volumeTable.test.ts`**

```ts
import { test, expect } from 'vitest';
import { weeklyRange } from '../volumeTable';
import { ALL_MUSCLES } from '../muscleGroup';
import { ALL_EFFORTS } from '../effort';

test('spot-check ranges match the Swift table', () => {
  expect(weeklyRange('chest', 'optimal')).toEqual({ low: 10, high: 14 });
  expect(weeklyRange('frontDelts', 'minimal')).toEqual({ low: 0, high: 4 });
  expect(weeklyRange('frontDelts', 'maximal')).toEqual({ low: 10, high: 12 });
  expect(weeklyRange('sideDelts', 'minimal')).toEqual({ low: 6, high: 10 });
  expect(weeklyRange('sideDelts', 'maximal')).toEqual({ low: 20, high: 26 });
  expect(weeklyRange('rearDelts', 'minimal')).toEqual({ low: 4, high: 8 });
  expect(weeklyRange('rearDelts', 'maximal')).toEqual({ low: 18, high: 24 });
  expect(weeklyRange('forearms', 'minimal')).toEqual({ low: 0, high: 3 });
  expect(weeklyRange('hamstrings', 'optimal')).toEqual({ low: 8, high: 12 });
});

test('every muscle has low <= high for every effort', () => {
  for (const m of ALL_MUSCLES) {
    for (const e of ALL_EFFORTS) {
      const rr = weeklyRange(m, e);
      expect(rr.low).toBeLessThanOrEqual(rr.high);
    }
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix web run test`
Expected: FAIL — cannot resolve `../volumeTable`.

- [ ] **Step 3: Write `web/src/core/volumeTable.ts`**

```ts
import type { MuscleGroup } from './muscleGroup';
import type { Effort } from './effort';

export interface SetRange {
  low: number;
  high: number;
}

export function r(low: number, high: number): SetRange {
  return { low, high };
}

// Weekly set range per muscle per effort (spec §4). Values copied verbatim from
// RiptideCore/Sources/RiptideCore/VolumeTable.swift.
const TABLE: Record<MuscleGroup, { minimal: SetRange; optimal: SetRange; maximal: SetRange }> = {
  chest:      { minimal: r(5, 8),  optimal: r(10, 14), maximal: r(15, 20) },
  lats:       { minimal: r(6, 9),  optimal: r(12, 16), maximal: r(17, 22) },
  frontDelts: { minimal: r(0, 4),  optimal: r(4, 8),   maximal: r(10, 12) },
  sideDelts:  { minimal: r(6, 10), optimal: r(12, 18), maximal: r(20, 26) },
  rearDelts:  { minimal: r(4, 8),  optimal: r(10, 16), maximal: r(18, 24) },
  traps:      { minimal: r(4, 8),  optimal: r(10, 16), maximal: r(17, 24) },
  quads:      { minimal: r(4, 8),  optimal: r(9, 14),  maximal: r(15, 20) },
  hamstrings: { minimal: r(4, 6),  optimal: r(8, 12),  maximal: r(13, 18) },
  calves:     { minimal: r(5, 8),  optimal: r(10, 16), maximal: r(18, 24) },
  triceps:    { minimal: r(4, 8),  optimal: r(10, 14), maximal: r(16, 20) },
  biceps:     { minimal: r(4, 8),  optimal: r(10, 14), maximal: r(16, 20) },
  forearms:   { minimal: r(0, 3),  optimal: r(4, 8),   maximal: r(10, 14) },
  abs:        { minimal: r(3, 6),  optimal: r(6, 12),  maximal: r(14, 18) },
};

export function weeklyRange(muscle: MuscleGroup, effort: Effort): SetRange {
  return TABLE[muscle][effort];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix web run test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/src/core/volumeTable.ts web/src/core/__tests__/volumeTable.test.ts
git commit -m "feat(core): port VolumeTable"
```

---

### Task 4: Allocation & determinism helpers

**Files:**
- Create: `web/src/core/util.ts`
- Create: `web/src/core/allocation.ts`
- Test: `web/src/core/__tests__/allocation.test.ts`

**Interfaces:**
- Consumes: `SetRange` (Task 3).
- Produces:
  - `util.ts`: `idiv(a, b): number` (truncate toward zero), `roundHalf(x): number` (half away from zero), `ceilDiv(a, b): number`, `assert(cond: boolean, msg: string): void`.
  - `allocation.ts`: `weeklyTarget(range: SetRange): number`, `entrySizes(sets: number, maxEntries: number): number[]`, `dayLoads(total: number, days: number, maxEntriesPerDay: number): number[]`, `spreadDays(k: number, days: number, phase: number): number[]`.

- [ ] **Step 1: Write the failing test `web/src/core/__tests__/allocation.test.ts`**

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix web run test`
Expected: FAIL — cannot resolve `../allocation`.

- [ ] **Step 3: Write `web/src/core/util.ts`**

```ts
/** Swift `Int` division truncates toward zero. All operands here are non-negative. */
export function idiv(a: number, b: number): number {
  return Math.trunc(a / b);
}

/** Swift `Double.rounded()` rounds half away from zero. */
export function roundHalf(x: number): number {
  return Math.sign(x) * Math.round(Math.abs(x));
}

/** Swift `Double.rounded(.up)` = ceiling. */
export function ceilDiv(a: number, b: number): number {
  return Math.ceil(a / b);
}

/** Mirrors a Swift `precondition`: fail fast on a broken caller contract. */
export function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}
```

- [ ] **Step 4: Write `web/src/core/allocation.ts`**

```ts
import type { SetRange } from './volumeTable';
import { idiv, roundHalf, ceilDiv, assert } from './util';

// Spec §5.1: weekly set target is the midpoint of the effort range, floored at 2.
// Returns 0 when the range can't support the 2-set minimum.
export function weeklyTarget(range: SetRange): number {
  if (range.high < 2) return 0;
  return Math.max(2, idiv(range.low + range.high, 2));
}

// Split one day's sets for one muscle into lift entries of 2-4 sets (spec §5.6):
// prefer 3s, then split across more exercises, then 4-set entries.
export function entrySizes(sets: number, maxEntries: number): number[] {
  assert(sets >= 2 && sets <= maxEntries * 4, 'caller must clamp to capacity');
  let count = ceilDiv(sets, 3);
  if (count > maxEntries) count = ceilDiv(sets, 4);
  const base = idiv(sets, count);
  const rem = sets % count;
  return Array.from({ length: count }, (_, i) => (i < rem ? base + 1 : base));
}

// How many days a muscle appears on and how many sets each such day carries.
// Concentrates at ~3 sets/appearance (spec §5.5); raises k so no day exceeds cap.
export function dayLoads(total: number, days: number, maxEntriesPerDay: number): number[] {
  if (total < 2) return [];
  const dailyCap = maxEntriesPerDay * 4;
  let k = Math.max(1, roundHalf(total / 3));
  k = Math.min(k, days);
  k = Math.max(k, ceilDiv(total, dailyCap));
  assert(k <= days, 'caller must clamp total to days * dailyCap');
  const base = idiv(total, k);
  const rem = total % k;
  return Array.from({ length: k }, (_, i) => (i < rem ? base + 1 : base));
}

// Choose k day indices spread evenly across `days`, starting from `phase` (spec §5.5).
export function spreadDays(k: number, days: number, phase: number): number[] {
  if (k <= 0 || days <= 0) return [];
  if (k >= days) return Array.from({ length: days }, (_, i) => i);
  return Array.from({ length: k }, (_, i) => (phase + idiv((2 * i + 1) * days, 2 * k)) % days);
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm --prefix web run test`
Expected: PASS — all allocation cases green.

- [ ] **Step 6: Commit**

```bash
git add web/src/core/util.ts web/src/core/allocation.ts web/src/core/__tests__/allocation.test.ts
git commit -m "feat(core): port Allocation with determinism helpers"
```

---

### Task 5: ExerciseBank & shared `exercises.json` contract

**Files:**
- Create: `web/scripts/sync-shared.mjs`
- Create: `web/src/core/data/exercises.json` (produced by running the sync script)
- Create: `web/src/core/exercise.ts`
- Test: `web/src/core/__tests__/exercise.test.ts`
- Test: `web/src/core/__tests__/sharedContract.test.ts`

**Interfaces:**
- Consumes: `MuscleGroup`, `ALL_MUSCLES` (Task 2).
- Produces: `interface ExerciseDefinition { id: string; name: string; primary: MuscleGroup; secondaries: MuscleGroup[]; repRange: string; blurb: string }`, and `ExerciseBank` with `all: ExerciseDefinition[]`, `exercisesFor(m): ExerciseDefinition[]`, `find(id): ExerciseDefinition | undefined`.

- [ ] **Step 1: Write the sync script `web/scripts/sync-shared.mjs`**

```js
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
```

- [ ] **Step 2: Run the sync script to create the web copy**

Run: `npm --prefix web run sync:shared`
Expected: prints `synced …/exercises.json -> …/web/src/core/data/exercises.json`; file now exists.

- [ ] **Step 3: Write the failing tests `web/src/core/__tests__/exercise.test.ts`**

```ts
import { test, expect } from 'vitest';
import { ExerciseBank } from '../exercise';
import { ALL_MUSCLES } from '../muscleGroup';

test('bank loads and is well-formed', () => {
  const all = ExerciseBank.all;
  expect(all.length).toBeGreaterThanOrEqual(40);
  expect(new Set(all.map((e) => e.id)).size).toBe(all.length);
  for (const ex of all) {
    expect(ex.secondaries).not.toContain(ex.primary);
    expect(ex.name.length).toBeGreaterThan(0);
    expect(ex.repRange.length).toBeGreaterThan(0);
  }
});

test('every muscle has at least two exercises', () => {
  for (const m of ALL_MUSCLES) {
    expect(ExerciseBank.exercisesFor(m).length).toBeGreaterThanOrEqual(2);
  }
});

test('secondaries follow the obvious-only rule (spec §6)', () => {
  expect(ExerciseBank.find('bench-press')?.secondaries).toEqual(['triceps']);
  expect(ExerciseBank.find('pull-up')?.secondaries).toEqual(['biceps']);
  expect(ExerciseBank.find('overhead-press')?.secondaries).toEqual(['triceps']);
  expect(ExerciseBank.find('back-squat')?.secondaries).toEqual([]);
  expect(ExerciseBank.find('romanian-deadlift')?.secondaries).toEqual([]);
});
```

- [ ] **Step 4: Write the failing test `web/src/core/__tests__/sharedContract.test.ts`**

```ts
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
```

- [ ] **Step 5: Run tests to verify they fail**

Run: `npm --prefix web run test`
Expected: FAIL — cannot resolve `../exercise` (both new test files fail to import).

- [ ] **Step 6: Write `web/src/core/exercise.ts`**

```ts
import type { MuscleGroup } from './muscleGroup';
import rawExercises from './data/exercises.json';

export interface ExerciseDefinition {
  id: string;
  name: string;
  primary: MuscleGroup;
  secondaries: MuscleGroup[];
  repRange: string;
  blurb: string;
}

const ALL = rawExercises as ExerciseDefinition[];

export const ExerciseBank = {
  all: ALL,
  exercisesFor(muscle: MuscleGroup): ExerciseDefinition[] {
    return ALL.filter((e) => e.primary === muscle);
  },
  find(id: string): ExerciseDefinition | undefined {
    return ALL.find((e) => e.id === id);
  },
};
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `npm --prefix web run test`
Expected: PASS — exercise + sharedContract green.

- [ ] **Step 8: Verify typecheck still passes (JSON import resolves)**

Run: `npm --prefix web run typecheck`
Expected: exit 0.

- [ ] **Step 9: Commit**

```bash
git add web/scripts/sync-shared.mjs web/src/core/data/exercises.json web/src/core/exercise.ts web/src/core/__tests__/exercise.test.ts web/src/core/__tests__/sharedContract.test.ts
git commit -m "feat(core): port ExerciseBank and sync shared exercises.json"
```

---

### Task 6: ProgramGenerator & ProgramPrinter

**Files:**
- Create: `web/src/core/programGenerator.ts`
- Create: `web/src/core/programPrinter.ts`
- Test: `web/src/core/__tests__/programGenerator.test.ts`

**Interfaces:**
- Consumes: `Effort`, `allowedDays`, `ALL_EFFORTS` (Task 2); `MuscleGroup`, `PROCESSING_ORDER`, `RECEIVERS`, `DISPLAY_ORDER`, `ALL_MUSCLES` (Task 2); `weeklyRange` (Task 3); `weeklyTarget`, `dayLoads`, `spreadDays`, `entrySizes` (Task 4); `ExerciseDefinition`, `ExerciseBank` (Task 5); `idiv`, `assert` (Task 4).
- Produces:
  - `programGenerator.ts`: `interface GeneratorInput { effort: Effort; days: number; selections: Map<MuscleGroup, ExerciseDefinition[]> }`, `interface GeneratedLift { exercise: ExerciseDefinition; sets: number }`, `interface GeneratedDay { lifts: GeneratedLift[] }`, `interface GeneratedProgram { days: GeneratedDay[] }`, `generate(input: GeneratorInput): GeneratedProgram`.
  - `programPrinter.ts`: `table(program: GeneratedProgram): string`.

- [ ] **Step 1: Write the failing test `web/src/core/__tests__/programGenerator.test.ts`**

```ts
import { test, expect } from 'vitest';
import { generate, type GeneratorInput } from '../programGenerator';
import { table } from '../programPrinter';
import { ALL_MUSCLES, type MuscleGroup } from '../muscleGroup';
import { ALL_EFFORTS, allowedDays, type Effort } from '../effort';
import { weeklyRange } from '../volumeTable';
import { weeklyTarget } from '../allocation';
import { ExerciseBank, type ExerciseDefinition } from '../exercise';

function fullInput(effort: Effort, days: number, perMuscle = 2): GeneratorInput {
  const sel = new Map<MuscleGroup, ExerciseDefinition[]>();
  for (const m of ALL_MUSCLES) sel.set(m, ExerciseBank.exercisesFor(m).slice(0, perMuscle));
  return { effort, days, selections: sel };
}
function selecting(muscle: MuscleGroup, exercises: ExerciseDefinition[], effort: Effort, days: number): GeneratorInput {
  const sel = new Map<MuscleGroup, ExerciseDefinition[]>();
  sel.set(muscle, exercises);
  return { effort, days, selections: sel };
}
const flat = (p: { days: { lifts: { exercise: ExerciseDefinition; sets: number }[] }[] }) =>
  p.days.flatMap((d) => d.lifts);

test('generation is deterministic', () => {
  const input = fullInput('optimal', 4);
  expect(table(generate(input))).toBe(table(generate(input)));
});

test('invariants hold across all efforts, day counts and exercise counts', () => {
  for (const effort of ALL_EFFORTS) {
    for (const days of allowedDays(effort)) {
      for (let perMuscle = 1; perMuscle <= 3; perMuscle++) {
        const input = fullInput(effort, days, perMuscle);
        const program = generate(input);
        expect(program.days.length).toBe(days);

        const weekly = new Map<MuscleGroup, number>();
        const secondary = new Map<MuscleGroup, number>();
        for (const day of program.days) {
          const seen = new Map<MuscleGroup, Set<string>>();
          for (const lift of day.lifts) {
            expect(lift.sets).toBeGreaterThanOrEqual(2);
            expect(lift.sets).toBeLessThanOrEqual(4);
            const set = seen.get(lift.exercise.primary) ?? new Set<string>();
            expect(set.has(lift.exercise.id)).toBe(false);
            set.add(lift.exercise.id);
            seen.set(lift.exercise.primary, set);
            weekly.set(lift.exercise.primary, (weekly.get(lift.exercise.primary) ?? 0) + lift.sets);
            for (const sec of lift.exercise.secondaries) {
              secondary.set(sec, (secondary.get(sec) ?? 0) + lift.sets);
            }
          }
        }
        for (const m of ALL_MUSCLES) {
          const range = weeklyRange(m, effort);
          if (range.high < 2) continue;
          const direct = weekly.get(m) ?? 0;
          const credit = Math.trunc((secondary.get(m) ?? 0) / 2);
          if ((input.selections.get(m) ?? []).length > 0) {
            expect(direct + credit).toBeGreaterThanOrEqual(range.low);
          }
          expect(direct).toBeLessThanOrEqual(range.high);
        }
        const totals = program.days.map((d) => d.lifts.reduce((s, l) => s + l.sets, 0));
        expect(Math.max(...totals) - Math.min(...totals)).toBeLessThanOrEqual(8);
      }
    }
  }
});

test('rotation covers every chosen exercise', () => {
  const program = generate(fullInput('optimal', 5, 3));
  const chest = new Set(flat(program).filter((l) => l.exercise.primary === 'chest').map((l) => l.exercise.id));
  expect(chest.size).toBe(3);
});

test('secondary credits reduce direct receiver work', () => {
  const program = generate(fullInput('optimal', 4, 2));
  const directTriceps = flat(program).filter((l) => l.exercise.primary === 'triceps').reduce((s, l) => s + l.sets, 0);
  const rawTarget = weeklyTarget(weeklyRange('triceps', 'optimal'));
  expect(directTriceps).toBeLessThan(rawTarget);
});

test('selected receiver still gets some direct work despite heavy credit', () => {
  const program = generate(fullInput('optimal', 4, 2));
  for (const muscle of ['triceps', 'biceps'] as MuscleGroup[]) {
    const direct = flat(program).filter((l) => l.exercise.primary === muscle).reduce((s, l) => s + l.sets, 0);
    expect(direct).toBeGreaterThanOrEqual(2);
    const secondary = flat(program).filter((l) => l.exercise.secondaries.includes(muscle)).reduce((s, l) => s + l.sets, 0);
    const range = weeklyRange(muscle, 'optimal');
    expect(direct + Math.trunc(secondary / 2)).toBeLessThanOrEqual(range.high + 1);
  }
});

test('single-exercise selection never shortfalls (corrected table)', () => {
  const program = generate(selecting('sideDelts', [ExerciseBank.find('db-lateral-raise')!], 'minimal', 2));
  const total = flat(program).reduce((s, l) => s + l.sets, 0);
  expect(total).toBeGreaterThanOrEqual(weeklyRange('sideDelts', 'minimal').low);
});

test('capacity clamps exactly to the low end without shortfall', () => {
  const program = generate(selecting('sideDelts', [ExerciseBank.find('db-lateral-raise')!], 'maximal', 5));
  const total = flat(program).reduce((s, l) => s + l.sets, 0);
  const range = weeklyRange('sideDelts', 'maximal');
  expect(total).toBe(20);
  expect(total).toBe(range.low);
  expect(weeklyTarget(range)).toBeGreaterThan(total);
});

test('exhaustive sweep finds no reachable shortfall', () => {
  for (const muscle of ALL_MUSCLES) {
    const available = ExerciseBank.exercisesFor(muscle);
    if (available.length === 0) continue;
    for (const effort of ALL_EFFORTS) {
      const range = weeklyRange(muscle, effort);
      if (range.high < 2) continue;
      for (const days of allowedDays(effort)) {
        for (let exerciseCount = 1; exerciseCount <= 3; exerciseCount++) {
          const capacity = days * exerciseCount * 4;
          expect(capacity).toBeGreaterThanOrEqual(range.low);
          const program = generate(selecting(muscle, available.slice(0, exerciseCount), effort, days));
          const total = program.days.flatMap((d) => d.lifts).reduce((s, l) => s + l.sets, 0);
          expect(total).toBeGreaterThanOrEqual(range.low);
        }
      }
    }
  }
});

test('unselected muscles are absent', () => {
  const program = generate(selecting('chest', ExerciseBank.exercisesFor('chest').slice(0, 2), 'optimal', 4));
  expect(flat(program).every((l) => l.exercise.primary === 'chest')).toBe(true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix web run test`
Expected: FAIL — cannot resolve `../programGenerator` / `../programPrinter`.

- [ ] **Step 3: Write `web/src/core/programGenerator.ts`**

```ts
import type { Effort } from './effort';
import { allowedDays } from './effort';
import type { MuscleGroup } from './muscleGroup';
import { PROCESSING_ORDER, RECEIVERS, DISPLAY_ORDER } from './muscleGroup';
import type { ExerciseDefinition } from './exercise';
import { weeklyRange } from './volumeTable';
import { weeklyTarget, dayLoads, spreadDays, entrySizes } from './allocation';
import { idiv, assert } from './util';

export interface GeneratorInput {
  effort: Effort;
  days: number;
  // Ordered as the user picked them; every present muscle has >= 1 exercise.
  selections: Map<MuscleGroup, ExerciseDefinition[]>;
}
export interface GeneratedLift {
  exercise: ExerciseDefinition;
  sets: number;
}
export interface GeneratedDay {
  lifts: GeneratedLift[];
}
export interface GeneratedProgram {
  days: GeneratedDay[];
}

// Deterministic, total over wizard-valid input (spec §5). Never throws for valid input.
export function generate(input: GeneratorInput): GeneratedProgram {
  assert(allowedDays(input.effort).includes(input.days), 'wizard gates day counts');

  const selected = PROCESSING_ORDER.filter((m) => (input.selections.get(m) ?? []).length > 0);
  const dayLifts: GeneratedLift[][] = Array.from({ length: input.days }, () => []);
  const dayTotals: number[] = new Array(input.days).fill(0);
  const secondarySets = new Map<MuscleGroup, number>();

  for (const muscle of selected) {
    const exercises = input.selections.get(muscle)!;
    const range = weeklyRange(muscle, input.effort);
    let target = weeklyTarget(range);

    // Spec §5.2: receivers get 0.5 credit per secondary set. Aim at midpoint - credit,
    // but guarantee >= 2 direct sets whenever there's still room under the range top.
    if (RECEIVERS.includes(muscle)) {
      const credit = idiv(secondarySets.get(muscle) ?? 0, 2);
      const aim = Math.max(0, target - credit);
      const headroom = Math.max(0, range.high - credit);
      target = Math.max(aim, headroom >= 2 ? 2 : 0);
    }
    if (target < 2) continue;

    // Spec §5.6 ladder step 4: clamp to capacity.
    const capacity = input.days * exercises.length * 4;
    const achieved = Math.min(target, capacity);
    if (achieved < 2) continue;

    const loads = dayLoads(achieved, input.days, exercises.length);
    const k = loads.length;

    // Spread this muscle's sessions evenly; among equally-spread rotations, pick the
    // one that best levels running daily totals. Stable sort keeps spreadDays order on ties.
    let dayOrder = [...spreadDays(k, input.days, 0)].sort((a, b) => dayTotals[a] - dayTotals[b]);
    let bestScore = Number.MAX_SAFE_INTEGER;
    for (let phase = 0; phase < input.days; phase++) {
      const slots = [...spreadDays(k, input.days, phase)].sort((a, b) => dayTotals[a] - dayTotals[b]);
      const trial = [...dayTotals];
      loads.forEach((load, i) => {
        trial[slots[i]] += load;
      });
      const score = trial.reduce((s, v) => s + v * v, 0); // lower = more level
      if (score < bestScore) {
        bestScore = score;
        dayOrder = slots;
      }
    }

    let rotation = 0;
    loads.forEach((load, i) => {
      const d = dayOrder[i];
      for (const size of entrySizes(load, exercises.length)) {
        const ex = exercises[rotation % exercises.length];
        rotation += 1;
        dayLifts[d].push({ exercise: ex, sets: size });
        dayTotals[d] += size;
        for (const sec of ex.secondaries) {
          secondarySets.set(sec, (secondarySets.get(sec) ?? 0) + size);
        }
      }
    });
  }

  // Within-day ordering: compounds-first display order (spec §5.7). Stable sort keeps
  // insertion order for lifts with the same primary and name.
  const days: GeneratedDay[] = dayLifts.map((lifts) => ({
    lifts: [...lifts].sort((a, b) => {
      const ia = DISPLAY_ORDER.indexOf(a.exercise.primary);
      const ib = DISPLAY_ORDER.indexOf(b.exercise.primary);
      if (ia !== ib) return ia - ib;
      if (a.exercise.name < b.exercise.name) return -1;
      if (a.exercise.name > b.exercise.name) return 1;
      return 0;
    }),
  }));
  return { days };
}
```

- [ ] **Step 4: Write `web/src/core/programPrinter.ts`**

```ts
import type { GeneratedProgram } from './programGenerator';

// Human-readable week, used by snapshot tests. Format is byte-identical to the Swift
// ProgramPrinter: note the em-dash "—" in the header and the trailing newline.
export function table(program: GeneratedProgram): string {
  const out: string[] = [];
  program.days.forEach((day, i) => {
    const total = day.lifts.reduce((s, l) => s + l.sets, 0);
    out.push(`Day ${i + 1} — ${day.lifts.length} lifts, ${total} sets`);
    for (const lift of day.lifts) {
      out.push(`  ${lift.exercise.name} [${lift.exercise.primary}] ${lift.sets} x ${lift.exercise.repRange}`);
    }
  });
  return out.join('\n') + '\n';
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm --prefix web run test`
Expected: PASS — all programGenerator invariant tests green.

- [ ] **Step 6: Commit**

```bash
git add web/src/core/programGenerator.ts web/src/core/programPrinter.ts web/src/core/__tests__/programGenerator.test.ts
git commit -m "feat(core): port ProgramGenerator and ProgramPrinter"
```

---

### Task 7: Snapshot parity against the Swift golden files

**Files:**
- Test: `web/src/core/__tests__/snapshot.test.ts`

**Interfaces:**
- Consumes: `generate`, `GeneratorInput` (Task 6); `table` (Task 6); `ALL_MUSCLES`, `MuscleGroup` (Task 2); `Effort` (Task 2); `ExerciseBank`, `ExerciseDefinition` (Task 5).
- Produces: nothing (verification-only gate).

This is the crown-jewel parity gate: it builds the exact same inputs as the Swift `SnapshotTests` and asserts the printed program equals the committed Swift golden file byte-for-byte.

- [ ] **Step 1: Write the failing test `web/src/core/__tests__/snapshot.test.ts`**

```ts
import { describe, test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generate, type GeneratorInput } from '../programGenerator';
import { table } from '../programPrinter';
import { ALL_MUSCLES, type MuscleGroup } from '../muscleGroup';
import type { Effort } from '../effort';
import { ExerciseBank, type ExerciseDefinition } from '../exercise';

const here = dirname(fileURLToPath(import.meta.url)); // web/src/core/__tests__
const snapDir = resolve(here, '../../../../RiptideCore/Tests/RiptideCoreTests/Snapshots');

function golden(name: string): string {
  return readFileSync(resolve(snapDir, `${name}.txt`), 'utf8');
}

// Mirrors the Swift SnapshotTests.input helper: every muscle, first `perMuscle`
// bank exercises each.
function input(effort: Effort, days: number, perMuscle: number): GeneratorInput {
  const sel = new Map<MuscleGroup, ExerciseDefinition[]>();
  for (const m of ALL_MUSCLES) sel.set(m, ExerciseBank.exercisesFor(m).slice(0, perMuscle));
  return { effort, days, selections: sel };
}

describe('snapshot parity vs Swift golden files', () => {
  test('optimal-4day-2ex', () => {
    expect(table(generate(input('optimal', 4, 2)))).toBe(golden('optimal-4day-2ex'));
  });
  test('minimal-2day-2ex', () => {
    expect(table(generate(input('minimal', 2, 2)))).toBe(golden('minimal-2day-2ex'));
  });
  test('maximal-7day-3ex', () => {
    expect(table(generate(input('maximal', 7, 3)))).toBe(golden('maximal-7day-3ex'));
  });
});
```

- [ ] **Step 2: Run the snapshot test**

Run: `npm --prefix web run test`
Expected: PASS — all three snapshots match.

If a snapshot FAILS, the diff points at the exact line. Debug in this order (most common causes of drift):
1. **Character substitution** — an ASCII `-` where the golden has `—` (header) or `–` (rep range). Fix `programPrinter.ts` / confirm `exercises.json` synced.
2. **Sort tie-breaking** — a comparator returning a boolean or not returning `0` on ties (see `dayOrder` and within-day sort in `programGenerator.ts`); Node's stable sort needs numeric comparators.
3. **Rounding/division** — a raw `/` or `Math.round` where `idiv` / `roundHalf` / `ceilDiv` is required (Task 4). All engine arithmetic on sets/days must go through the helpers.
4. **Iteration order** — the outer loop must iterate `PROCESSING_ORDER` filtered by selection, not the `selections` Map order.

Do NOT edit the golden files to make the test pass — they are the Swift contract. Fix the TypeScript.

- [ ] **Step 3: Commit**

```bash
git add web/src/core/__tests__/snapshot.test.ts
git commit -m "test(core): snapshot parity against Swift golden files"
```

---

### Task 8: Public barrel & final verification

**Files:**
- Create: `web/src/core/index.ts`
- Delete: `web/src/core/__tests__/smoke.test.ts`

**Interfaces:**
- Consumes: all public exports from Tasks 2-6.
- Produces: `web/src/core/index.ts` — the single import surface the Plan-2 app will consume (`import { generate, ExerciseBank, ... } from './core'`).

- [ ] **Step 1: Write `web/src/core/index.ts`**

```ts
export type { MuscleGroup } from './muscleGroup';
export {
  ALL_MUSCLES, GIVERS, RECEIVERS, PROCESSING_ORDER, DISPLAY_ORDER, muscleLabel,
} from './muscleGroup';

export type { Effort } from './effort';
export { ALL_EFFORTS, allowedDays, effortLabel } from './effort';

export type { SetRange } from './volumeTable';
export { weeklyRange } from './volumeTable';

export type { ExerciseDefinition } from './exercise';
export { ExerciseBank } from './exercise';

export { weeklyTarget, entrySizes, dayLoads, spreadDays } from './allocation';

export type {
  GeneratorInput, GeneratedLift, GeneratedDay, GeneratedProgram,
} from './programGenerator';
export { generate } from './programGenerator';

export { table } from './programPrinter';
```

- [ ] **Step 2: Delete the smoke test**

Run: `rm web/src/core/__tests__/smoke.test.ts`

- [ ] **Step 3: Add a barrel import test `web/src/core/__tests__/index.test.ts`**

```ts
import { test, expect } from 'vitest';
import * as core from '../index';

test('barrel exposes the public engine surface', () => {
  expect(typeof core.generate).toBe('function');
  expect(typeof core.table).toBe('function');
  expect(typeof core.weeklyRange).toBe('function');
  expect(core.ExerciseBank.all.length).toBeGreaterThanOrEqual(40);
  expect(core.ALL_MUSCLES.length).toBe(13);
});
```

- [ ] **Step 4: Run the full suite**

Run: `npm --prefix web run test`
Expected: PASS — every suite green, no smoke test present.

- [ ] **Step 5: Verify typecheck passes**

Run: `npm --prefix web run typecheck`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add web/src/core/index.ts web/src/core/__tests__/index.test.ts
git rm web/src/core/__tests__/smoke.test.ts
git commit -m "feat(core): public engine barrel; drop smoke test"
```

---

## Self-Review

**1. Spec coverage (against §4 of the design spec):**
- §4.1 isolated dependency-free module → Task 1 package + Global Constraints (no React/Firebase imports); all engine files under `src/core/`.
- §4.1 ported units (MuscleGroup, Effort, VolumeTable, Allocation, ProgramGenerator, ProgramPrinter, ExerciseDefinition/ExerciseBank) → Tasks 2-6.
- §4.2 shared `exercises.json` + guarded against drift → Task 5 (sync script + `sharedContract.test.ts`); decision recorded (synced copy for bundling, contract test guards). Snapshot golden files read directly from the Swift tree → Task 7.
- §4.3 full test port incl. snapshots → Tasks 2-7 port `AllocationTests`, `VolumeTableTests` (incl. orderings), `ExerciseBankTests`, `ProgramGeneratorTests` (incl. exhaustive sweep), and `SnapshotTests`.
- Determinism concerns (rounding, integer division, stable sort, unicode dashes) → Global Constraints + Task 4 helpers + Task 7 debug guide.

**2. Placeholder scan:** No TBD/TODO/"handle edge cases"; every code and test step contains complete content; commands have expected output.

**3. Type consistency:** Names used consistently across tasks — `weeklyRange`, `weeklyTarget`, `entrySizes`, `dayLoads`, `spreadDays`, `exercisesFor`, `find`, `generate`, `table`, `idiv`, `roundHalf`, `ceilDiv`, `assert`; `GeneratorInput.selections` is a `Map<MuscleGroup, ExerciseDefinition[]>` in both the generator (Task 6) and every test that builds input (Tasks 6-7); `SetRange` shape `{ low, high }` used in Tasks 3, 4, 6.

**Note (not covered here):** the two Swift tests `testWeeklyTargetIsMidpoint` edge values and `VolumeTableTests.testOrderings` are covered by Tasks 4 and 2 respectively. The Swift `ExerciseBankTests` count assertion (`>= 40`) is satisfied by the 51-exercise bank.

**Out of scope for this plan (later plans):** Vite/React/Tailwind, Firebase, screens, auth, offline, PWA shell.
