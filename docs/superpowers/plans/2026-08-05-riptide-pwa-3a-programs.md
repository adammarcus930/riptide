# Riptide PWA — Plan 3a: Programs & Planning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the program-planning half of Riptide on the Plan 2 foundation — the `programs` data layer plus the Wizard, Program library, Program detail, and Day detail (view + edit) — a faithful port of the Swift planning screens, developed emulator-first.

**Architecture:** New pure mapping (`materialize`) turns the engine's `GeneratedProgram` into a Firestore `ProgramDoc`; a `programs` repository (repository writes + `onSnapshot` hooks, following Plan 2's `profile.ts`) persists and streams them under `users/{uid}/programs`; React Router gains the Program-tab routes; screens are ported from the Swift sources. Programs are single-active (enforced by batched writes). Day/lift edits rewrite the program doc's nested `days` array.

**Tech Stack:** (unchanged from Plan 2) React 18 + TS strict + Vite + Tailwind + React Router 6 + Firebase 10, Vitest + RTL (default tier) and `@firebase/rules-unit-testing` / emulator (emulator tier). Engine from `web/src/core`.

## Global Constraints

- **Node 20+**, npm via `npm --prefix web …` (never `cd`); npm scripts run with cwd `web/`.
- **Engine (`web/src/core`) is imported, never modified.** Import via the barrel: `import { … } from '../core'`.
- **Two test tiers:** `npm --prefix web run test` (jsdom, hermetic, excludes `**/*.emulator.test.*`) is the gate for every task; `npm --prefix web run test:emulator` runs `*.emulator.test.ts` against the Firestore+Auth emulators (OpenJDK already installed; the script sets PATH; emulator project id `demo-riptide`).
- **Reactive data pattern (from Plan 2 `data/profile.ts`):** repository async functions for writes; hooks over `onSnapshot` for reads, each with a `(snap)=>…` and an `(err)=>{ console.error(...); setLoading(false); }` error callback. Read docs as `{ id: snap.id, ...(snap.data() as T) }`.
- **Single active program** is a data-layer invariant (batched writes), not a UI concern.
- **Editing model:** days/lifts are nested in the program doc; every edit rewrites the whole `days` array via one `updateDoc`. Lifts carry an `order`; reorder re-indexes `order` from array position.
- **Ice-palette Tailwind tokens** (from Plan 2 `tailwind.config.js`): `bg-base`, `bg-card`, `bg-input`, `text-ink`, `text-ink-dim`, `text-ink-faint`, `text-accent`, `bg-accent`, `text-on-accent`, `border-stroke`, `border-stroke-strong`, `rounded-card`, `rounded-btn`. Reuse `ui/Card`, `ui/AccentButton`, `ui/Eyebrow`.
- **Faithful port:** behavior mirrors the Swift sources (`WizardView`, `ProgramMaterializer`, `ProgramView`/`ProgramDetailView`, `DayDetailView`, `AddLiftView`) except the added Wizard **name step** (default `"{days}-Day {Effort label}"`).
- **Program naming:** auto-default `"{days}-Day {effortLabel(effort)}"` (e.g. `"4-Day Optimal"`), user-editable, non-empty required. Never "Block".

## File Structure

```
web/src/
  data/
    types.ts            # MODIFY: ProgramDoc +effort +muscles; ProgramDayDoc -focus (Task 1)
    materialize.ts      # NEW: NewProgramInput, toGeneratorInput, materialize, dayFocus (Task 1)
    paths.ts            # MODIFY: add programDoc(uid,id) (Task 2)
    programs.ts         # NEW: repository + hooks (Task 2)
    __tests__/
      materialize.test.ts       # Task 1 (default tier)
      programs.emulator.test.ts # Task 2 (emulator tier)
  screens/
    ProgramLibraryScreen.tsx     # Task 3 (replaces ProgramScreen placeholder)
    ProgramLibraryScreen.test.tsx
    WizardScreen.tsx             # Task 4
    WizardScreen.test.tsx
    ProgramDetailScreen.tsx      # Task 5
    ProgramDetailScreen.test.tsx
    DayDetailScreen.tsx          # Task 6
    DayDetailScreen.test.tsx
    ProgramScreen.tsx            # DELETE in Task 3
  App.tsx               # MODIFY: routes (Task 3), wizard route (Task 4 wires nav)
```

---

### Task 1: Data model, `materialize`, and `dayFocus`

**Files:**
- Modify: `web/src/data/types.ts`
- Create: `web/src/data/materialize.ts`
- Test: `web/src/data/__tests__/materialize.test.ts`

**Interfaces:**
- Consumes: `generate`, `DISPLAY_ORDER`, `muscleLabel`, and types `Effort`, `MuscleGroup`, `ExerciseDefinition`, `GeneratedProgram`, `GeneratorInput` from `../core`.
- Produces:
  - Updated `ProgramDoc` (`+ effort: Effort`, `+ muscles: MuscleGroup[]`) and `ProgramDayDoc` (`- focus`).
  - `interface NewProgramInput { name: string; effort: Effort; days: number; selections: Map<MuscleGroup, ExerciseDefinition[]> }`
  - `toGeneratorInput(input: NewProgramInput): GeneratorInput`
  - `materialize(generated: GeneratedProgram, input: NewProgramInput): ProgramDoc`
  - `dayFocus(lifts: PlannedLiftDoc[]): string`

- [ ] **Step 1: Update `web/src/data/types.ts`**

Replace the `PlannedLiftDoc`/`ProgramDayDoc`/`ProgramDoc` block and the top import:

```ts
import type { Effort, MuscleGroup } from '../core';

export interface Profile {
  restAlertSec: number;
}
export interface PlannedLiftDoc {
  exerciseId: string;
  exerciseName: string;
  muscle: MuscleGroup;
  repRange: string;
  targetSets: number;
  order: number;
}
export interface ProgramDayDoc {
  index: number;
  completedInCycle: boolean;
  lifts: PlannedLiftDoc[];
}
export interface ProgramDoc {
  name: string;
  effort: Effort;
  muscles: MuscleGroup[];
  isActive: boolean;
  daysPerWeek: number;
  createdAt: number;
  days: ProgramDayDoc[];
}
```
(Leave `SessionDoc` and `LoggedSetDoc` exactly as they are.)

- [ ] **Step 2: Write the failing test `web/src/data/__tests__/materialize.test.ts`**

```ts
import { test, expect } from 'vitest';
import { materialize, toGeneratorInput, dayFocus, type NewProgramInput } from '../materialize';
import { generate, ExerciseBank, ALL_MUSCLES, type MuscleGroup, type ExerciseDefinition } from '../../core';

function fullInput(days: number, perMuscle: number): NewProgramInput {
  const selections = new Map<MuscleGroup, ExerciseDefinition[]>();
  for (const m of ALL_MUSCLES) selections.set(m, ExerciseBank.exercisesFor(m).slice(0, perMuscle));
  return { name: '4-Day Optimal', effort: 'optimal', days, selections };
}

test('materialize maps a generated program into a ProgramDoc', () => {
  const input = fullInput(4, 2);
  const doc = materialize(generate(toGeneratorInput(input)), input);
  expect(doc.name).toBe('4-Day Optimal');
  expect(doc.effort).toBe('optimal');
  expect(doc.daysPerWeek).toBe(4);
  expect(doc.isActive).toBe(true);
  expect(doc.days).toHaveLength(4);
  // muscles are in DISPLAY_ORDER and only selected ones (all selected here).
  expect(doc.muscles).toContain('chest');
  // day/lift indices and order are 0-based and sequential.
  doc.days.forEach((d, i) => {
    expect(d.index).toBe(i);
    expect(d.completedInCycle).toBe(false);
    d.lifts.forEach((l, j) => {
      expect(l.order).toBe(j);
      expect(l.exerciseId).toBeTruthy();
      expect(l.targetSets).toBeGreaterThanOrEqual(2);
    });
  });
});

test('materialize includes only selected muscles, in DISPLAY_ORDER', () => {
  const selections = new Map<MuscleGroup, ExerciseDefinition[]>();
  selections.set('chest', ExerciseBank.exercisesFor('chest').slice(0, 2));
  selections.set('quads', ExerciseBank.exercisesFor('quads').slice(0, 2));
  const input: NewProgramInput = { name: 'x', effort: 'optimal', days: 4, selections };
  const doc = materialize(generate(toGeneratorInput(input)), input);
  expect(doc.muscles).toEqual(['quads', 'chest']); // DISPLAY_ORDER puts quads before chest
});

test('dayFocus lists each muscle once, in lift order, joined by " · "', () => {
  expect(
    dayFocus([
      { order: 0, muscle: 'chest', exerciseId: 'a', exerciseName: 'A', repRange: '5-8', targetSets: 3 },
      { order: 1, muscle: 'chest', exerciseId: 'b', exerciseName: 'B', repRange: '5-8', targetSets: 3 },
      { order: 2, muscle: 'triceps', exerciseId: 'c', exerciseName: 'C', repRange: '10-15', targetSets: 2 },
    ]),
  ).toBe('Chest · Triceps');
  expect(dayFocus([])).toBe('');
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm --prefix web run test`
Expected: FAIL — cannot resolve `../materialize`.

- [ ] **Step 4: Write `web/src/data/materialize.ts`**

```ts
import {
  generate,
  DISPLAY_ORDER,
  muscleLabel,
  type Effort,
  type MuscleGroup,
  type ExerciseDefinition,
  type GeneratedProgram,
  type GeneratorInput,
} from '../core';
import type { ProgramDoc, PlannedLiftDoc } from './types';

export interface NewProgramInput {
  name: string;
  effort: Effort;
  days: number;
  selections: Map<MuscleGroup, ExerciseDefinition[]>;
}

export function toGeneratorInput(input: NewProgramInput): GeneratorInput {
  return { effort: input.effort, days: input.days, selections: input.selections };
}

// Mirrors the Swift ProgramMaterializer: generator output copied once into an
// editable ProgramDoc. Pure — no Firestore. `isActive: true`; the caller's batch
// write enforces the single-active invariant.
export function materialize(generated: GeneratedProgram, input: NewProgramInput): ProgramDoc {
  const muscles = DISPLAY_ORDER.filter((m) => (input.selections.get(m) ?? []).length > 0);
  const days = generated.days.map((day, i) => ({
    index: i,
    completedInCycle: false,
    lifts: day.lifts.map((lift, j) => ({
      order: j,
      exerciseId: lift.exercise.id,
      exerciseName: lift.exercise.name,
      muscle: lift.exercise.primary,
      repRange: lift.exercise.repRange,
      targetSets: lift.sets,
    })),
  }));
  return {
    name: input.name,
    effort: input.effort,
    muscles,
    isActive: true,
    daysPerWeek: input.days,
    createdAt: Date.now(),
    days,
  };
}

// Computed focus (Swift ProgramDay.focus): each lift muscle once, in lift order.
export function dayFocus(lifts: PlannedLiftDoc[]): string {
  const seen: MuscleGroup[] = [];
  for (const l of [...lifts].sort((a, b) => a.order - b.order)) {
    if (!seen.includes(l.muscle)) seen.push(l.muscle);
  }
  return seen.map(muscleLabel).join(' · ');
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm --prefix web run test`
Expected: PASS (materialize + dayFocus). Engine + Plan 2 tests still pass. Also run `npm --prefix web run typecheck` → exit 0 (confirms removing `focus`/adding fields broke nothing).

- [ ] **Step 6: Commit**

```bash
git add web/src/data/types.ts web/src/data/materialize.ts web/src/data/__tests__/materialize.test.ts
git commit -m "feat(web): program doc schema, materialize mapping, dayFocus helper"
```

---

### Task 2: `programs` repository & hooks

**Files:**
- Modify: `web/src/data/paths.ts`
- Create: `web/src/data/programs.ts`
- Test: `web/src/data/__tests__/programs.emulator.test.ts`

**Interfaces:**
- Consumes: `db` (`../firebase`); `programsCol`, `programDoc` (`./paths`); `generate` (`../core`); `materialize`, `toGeneratorInput`, `NewProgramInput` (`./materialize`); `ProgramDoc`, `ProgramDayDoc` (`./types`).
- Produces:
  - `programDoc(uid, id)` path helper.
  - `type ProgramWithId = ProgramDoc & { id: string }`.
  - `createProgram(uid, input): Promise<string>`, `setActiveProgram(uid, id): Promise<void>`, `renameProgram(uid, id, name): Promise<void>`, `deleteProgram(uid, id): Promise<void>`, `updateProgramDays(uid, id, days): Promise<void>`.
  - `usePrograms(uid): { programs: ProgramWithId[]; loading }`, `useProgram(uid, id): { program: ProgramWithId | null; loading }`, `useActiveProgram(uid): { program: ProgramWithId | null; loading }`.

- [ ] **Step 1: Add `programDoc` to `web/src/data/paths.ts`**

Append:
```ts
export const programDoc = (uid: string, id: string) => doc(db, 'users', uid, 'programs', id);
```
(`doc` and `db` are already imported in the file.)

- [ ] **Step 2: Write the failing emulator test `web/src/data/__tests__/programs.emulator.test.ts`**

```ts
import { beforeAll, afterEach, afterAll, test, expect } from 'vitest';
import { initializeApp, deleteApp, type FirebaseApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, signInAnonymously } from 'firebase/auth';
import {
  getFirestore, connectFirestoreEmulator, getDocs, collection, deleteDoc, doc,
} from 'firebase/firestore';
import { ExerciseBank, ALL_MUSCLES, type MuscleGroup, type ExerciseDefinition } from '../../core';

// The repository reads db from ../firebase, which points at the emulator when
// VITE_USE_EMULATOR=1. Ensure that before importing it.
import.meta.env.VITE_USE_EMULATOR = '1';

let app: FirebaseApp;
let uid: string;

beforeAll(async () => {
  app = initializeApp({ projectId: 'demo-riptide', apiKey: 'demo', appId: 'demo' }, 'programs-test');
  const auth = getAuth(app);
  connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
  connectFirestoreEmulator(getFirestore(app), 'localhost', 8080);
  uid = (await signInAnonymously(auth)).user.uid;
});
afterEach(async () => {
  const snap = await getDocs(collection(getFirestore(app), 'users', uid, 'programs'));
  await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
});
afterAll(async () => {
  await deleteApp(app);
});

function input(name: string, days = 4) {
  const selections = new Map<MuscleGroup, ExerciseDefinition[]>();
  for (const m of ALL_MUSCLES) selections.set(m, ExerciseBank.exercisesFor(m).slice(0, 2));
  return { name, effort: 'optimal' as const, days, selections };
}
async function list() {
  const { createProgram, setActiveProgram, renameProgram, deleteProgram } = await import('../programs');
  const snap = await getDocs(collection(getFirestore(app), 'users', uid, 'programs'));
  return { createProgram, setActiveProgram, renameProgram, deleteProgram, docs: snap.docs };
}

test('createProgram writes a program and it is the only active one', async () => {
  const { createProgram } = await import('../programs');
  await createProgram(uid, input('A'));
  await createProgram(uid, input('B'));
  const snap = await getDocs(collection(getFirestore(app), 'users', uid, 'programs'));
  const active = snap.docs.filter((d) => d.data().isActive);
  expect(snap.docs).toHaveLength(2);
  expect(active).toHaveLength(1);
  expect(active[0].data().name).toBe('B'); // newest created is active
});

test('setActiveProgram moves the active flag', async () => {
  const { createProgram, setActiveProgram } = await import('../programs');
  const aId = await createProgram(uid, input('A'));
  await createProgram(uid, input('B'));
  await setActiveProgram(uid, aId);
  const snap = await getDocs(collection(getFirestore(app), 'users', uid, 'programs'));
  const active = snap.docs.filter((d) => d.data().isActive);
  expect(active).toHaveLength(1);
  expect(active[0].id).toBe(aId);
});

test('renameProgram and deleteProgram work', async () => {
  const { createProgram, renameProgram, deleteProgram } = await import('../programs');
  const id = await createProgram(uid, input('A'));
  await renameProgram(uid, id, 'Renamed');
  let snap = await getDocs(collection(getFirestore(app), 'users', uid, 'programs'));
  expect(snap.docs[0].data().name).toBe('Renamed');
  await deleteProgram(uid, id);
  snap = await getDocs(collection(getFirestore(app), 'users', uid, 'programs'));
  expect(snap.docs).toHaveLength(0);
});
```

- [ ] **Step 3: Run the emulator test to verify it fails**

Run: `npm --prefix web run test:emulator`
Expected: FAIL — cannot resolve `../programs`.

- [ ] **Step 4: Write `web/src/data/programs.ts`**

```ts
import { useEffect, useState } from 'react';
import {
  onSnapshot, query, orderBy, where, getDocs, doc, writeBatch, updateDoc, deleteDoc,
} from 'firebase/firestore';
import { db } from '../firebase';
import { programsCol, programDoc } from './paths';
import { generate } from '../core';
import { materialize, toGeneratorInput, type NewProgramInput } from './materialize';
import type { ProgramDoc, ProgramDayDoc } from './types';

export type ProgramWithId = ProgramDoc & { id: string };

// --- writes ---

export async function createProgram(uid: string, input: NewProgramInput): Promise<string> {
  const data = materialize(generate(toGeneratorInput(input)), input);
  const existing = await getDocs(programsCol(uid));
  const batch = writeBatch(db);
  existing.forEach((d) => batch.update(d.ref, { isActive: false }));
  const ref = doc(programsCol(uid));
  batch.set(ref, data);
  await batch.commit();
  return ref.id;
}

export async function setActiveProgram(uid: string, id: string): Promise<void> {
  const existing = await getDocs(programsCol(uid));
  const batch = writeBatch(db);
  existing.forEach((d) => batch.update(d.ref, { isActive: d.id === id }));
  await batch.commit();
}

export async function renameProgram(uid: string, id: string, name: string): Promise<void> {
  await updateDoc(programDoc(uid, id), { name });
}

export async function deleteProgram(uid: string, id: string): Promise<void> {
  await deleteDoc(programDoc(uid, id));
}

export async function updateProgramDays(uid: string, id: string, days: ProgramDayDoc[]): Promise<void> {
  await updateDoc(programDoc(uid, id), { days });
}

// --- reactive reads ---

export function usePrograms(uid: string | undefined): { programs: ProgramWithId[]; loading: boolean } {
  const [programs, setPrograms] = useState<ProgramWithId[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!uid) { setPrograms([]); setLoading(false); return; }
    setLoading(true);
    return onSnapshot(
      query(programsCol(uid), orderBy('createdAt', 'desc')),
      (snap) => {
        setPrograms(snap.docs.map((d) => ({ id: d.id, ...(d.data() as ProgramDoc) })));
        setLoading(false);
      },
      (err) => { console.error('programs listener failed', err); setLoading(false); },
    );
  }, [uid]);
  return { programs, loading };
}

export function useProgram(
  uid: string | undefined,
  id: string | undefined,
): { program: ProgramWithId | null; loading: boolean } {
  const [program, setProgram] = useState<ProgramWithId | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!uid || !id) { setProgram(null); setLoading(false); return; }
    setLoading(true);
    return onSnapshot(
      programDoc(uid, id),
      (snap) => {
        setProgram(snap.exists() ? { id: snap.id, ...(snap.data() as ProgramDoc) } : null);
        setLoading(false);
      },
      (err) => { console.error('program listener failed', err); setLoading(false); },
    );
  }, [uid, id]);
  return { program, loading };
}

export function useActiveProgram(uid: string | undefined): { program: ProgramWithId | null; loading: boolean } {
  const [program, setProgram] = useState<ProgramWithId | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!uid) { setProgram(null); setLoading(false); return; }
    setLoading(true);
    return onSnapshot(
      query(programsCol(uid), where('isActive', '==', true)),
      (snap) => {
        const d = snap.docs[0];
        setProgram(d ? { id: d.id, ...(d.data() as ProgramDoc) } : null);
        setLoading(false);
      },
      (err) => { console.error('active program listener failed', err); setLoading(false); },
    );
  }, [uid]);
  return { program, loading };
}
```

- [ ] **Step 5: Run the emulator test to verify it passes**

Run: `npm --prefix web run test:emulator`
Expected: PASS (rules + profile + the 3 programs tests). If a test hangs, confirm the emulators started (the script boots them).

- [ ] **Step 6: Confirm the default tier is unaffected**

Run: `npm --prefix web run test` → PASS (the emulator test is excluded). Run `npm --prefix web run typecheck` → exit 0.

- [ ] **Step 7: Commit**

```bash
git add web/src/data/paths.ts web/src/data/programs.ts web/src/data/__tests__/programs.emulator.test.ts
git commit -m "feat(web): programs repository and reactive hooks (single-active invariant)"
```

---

### Task 3: Routing + Program library screen

**Files:**
- Create: `web/src/screens/ProgramLibraryScreen.tsx`
- Delete: `web/src/screens/ProgramScreen.tsx`
- Modify: `web/src/App.tsx`
- Test: `web/src/screens/ProgramLibraryScreen.test.tsx`

**Interfaces:**
- Consumes: `useAuth` (`../auth/useAuth`); `usePrograms` (`../data/programs`); `dayFocus` (`../data/materialize`); `Card`/`Eyebrow` (`../ui/*`); React Router `Link`/`useNavigate`.
- Produces: `ProgramLibraryScreen`, and the full Program-tab + wizard route wiring in `App.tsx`.

- [ ] **Step 1: Write `web/src/screens/ProgramLibraryScreen.tsx`**

```tsx
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { usePrograms } from '../data/programs';
import { dayFocus } from '../data/materialize';
import { Eyebrow } from '../ui/Eyebrow';

export function ProgramLibraryScreen() {
  const { user } = useAuth();
  const { programs, loading } = usePrograms(user?.uid);

  return (
    <main className="flex flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <Eyebrow>Programs</Eyebrow>
        <Link to="/wizard" className="text-[13px] font-extrabold text-accent">
          + New program
        </Link>
      </div>
      <h1 className="text-3xl font-extrabold text-ink">Your programs</h1>

      {loading ? (
        <p className="text-ink-faint">Loading…</p>
      ) : programs.length === 0 ? (
        <div className="rounded-card border border-stroke bg-card p-5">
          <p className="text-[15px] font-bold text-ink">No programs yet.</p>
          <p className="mt-1 text-[13px] text-ink-dim">Build one and it becomes your active plan.</p>
          <Link
            to="/wizard"
            className="mt-4 inline-block rounded-btn bg-accent px-5 py-3 text-[15px] font-extrabold text-on-accent"
          >
            Build a program
          </Link>
        </div>
      ) : (
        programs.map((p) => (
          <Link
            key={p.id}
            to={`/program/${p.id}`}
            className="rounded-card border border-stroke bg-card p-4"
          >
            <div className="flex items-center justify-between">
              <span className="text-[16px] font-bold text-ink">{p.name}</span>
              {p.isActive && (
                <span className="rounded-full bg-accent/10 px-2 py-1 text-[10px] font-extrabold tracking-[1px] text-accent">
                  ACTIVE
                </span>
              )}
            </div>
            <p className="mt-1 text-[12px] text-ink-dim">{p.daysPerWeek} days · {p.days.length} sessions</p>
          </Link>
        ))
      )}
    </main>
  );
}
```

- [ ] **Step 2: Delete the placeholder**

Run: `git rm web/src/screens/ProgramScreen.tsx`

- [ ] **Step 3: Update `web/src/App.tsx`**

```tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './auth/AuthProvider';
import { RequireAuth } from './auth/RequireAuth';
import { LoginScreen } from './auth/LoginScreen';
import { AppShell } from './screens/AppShell';
import { TodayScreen } from './screens/TodayScreen';
import { ProgramLibraryScreen } from './screens/ProgramLibraryScreen';
import { ProgramDetailScreen } from './screens/ProgramDetailScreen';
import { DayDetailScreen } from './screens/DayDetailScreen';
import { WizardScreen } from './screens/WizardScreen';
import { MoreScreen } from './screens/MoreScreen';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginScreen />} />
          <Route element={<RequireAuth />}>
            <Route path="/wizard" element={<WizardScreen />} />
            <Route element={<AppShell />}>
              <Route index element={<TodayScreen />} />
              <Route path="program" element={<ProgramLibraryScreen />} />
              <Route path="program/:id" element={<ProgramDetailScreen />} />
              <Route path="program/:id/day/:dayIndex" element={<DayDetailScreen />} />
              <Route path="more" element={<MoreScreen />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
```
(`ProgramDetailScreen`, `DayDetailScreen`, `WizardScreen` are created in Tasks 4–6. To keep this task's build green, create minimal placeholder files for the two not built here — see Step 4.)

- [ ] **Step 4: Add temporary placeholders so the app compiles**

Create `web/src/screens/WizardScreen.tsx`, `web/src/screens/ProgramDetailScreen.tsx`, `web/src/screens/DayDetailScreen.tsx`, each:
```tsx
export function WizardScreen() { return <div className="p-6 text-ink">Wizard (Task 4)</div>; }
```
(name the export to match each file: `WizardScreen`, `ProgramDetailScreen`, `DayDetailScreen`. Tasks 4–6 replace these bodies.)

- [ ] **Step 5: Write the failing test `web/src/screens/ProgramLibraryScreen.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react';
import { test, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../auth/useAuth', () => ({ useAuth: () => ({ user: { uid: 'u1' } }) }));
const usePrograms = vi.fn();
vi.mock('../data/programs', () => ({ usePrograms: (uid: string) => usePrograms(uid) }));

import { ProgramLibraryScreen } from './ProgramLibraryScreen';

function renderScreen() {
  return render(<MemoryRouter><ProgramLibraryScreen /></MemoryRouter>);
}

test('shows the empty state with a build link when there are no programs', () => {
  usePrograms.mockReturnValue({ programs: [], loading: false });
  renderScreen();
  expect(screen.getByText('No programs yet.')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Build a program' })).toHaveAttribute('href', '/wizard');
});

test('lists programs and marks the active one', () => {
  usePrograms.mockReturnValue({
    loading: false,
    programs: [
      { id: 'a', name: '4-Day Optimal', isActive: true, daysPerWeek: 4, days: [{}, {}, {}, {}] },
      { id: 'b', name: 'Old Plan', isActive: false, daysPerWeek: 3, days: [{}, {}, {}] },
    ],
  });
  renderScreen();
  expect(screen.getByText('4-Day Optimal')).toBeInTheDocument();
  expect(screen.getByText('ACTIVE')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /Old Plan/ })).toHaveAttribute('href', '/program/b');
});
```

- [ ] **Step 6: Run tests + typecheck**

Run: `npm --prefix web run test` → PASS (library tests + all prior). Run `npm --prefix web run typecheck` → exit 0. Run `npm --prefix web run build` → succeeds.

- [ ] **Step 7: Commit**

```bash
git add web/src/screens/ProgramLibraryScreen.tsx web/src/screens/ProgramLibraryScreen.test.tsx web/src/screens/WizardScreen.tsx web/src/screens/ProgramDetailScreen.tsx web/src/screens/DayDetailScreen.tsx web/src/App.tsx
git rm web/src/screens/ProgramScreen.tsx 2>/dev/null; git add -u
git commit -m "feat(web): program library screen and program-tab routing"
```

---

### Task 4: Wizard screen

**Files:**
- Modify: `web/src/screens/WizardScreen.tsx` (replace placeholder)
- Test: `web/src/screens/WizardScreen.test.tsx`

**Interfaces:**
- Consumes: `useAuth`; `createProgram` (`../data/programs`); `Effort`, `ALL_EFFORTS`, `effortLabel`, `allowedDays`, `MuscleGroup`, `DISPLAY_ORDER`, `muscleLabel`, `weeklyRange`, `ExerciseBank`, `ExerciseDefinition` (`../core`); `useNavigate` (react-router). 
- Produces: `WizardScreen` — collects `{ effort, days, selections }`, names the program, calls `createProgram`, navigates to `/program/:id`.

- [ ] **Step 1: Write `web/src/screens/WizardScreen.tsx`**

```tsx
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { createProgram } from '../data/programs';
import {
  ALL_EFFORTS, allowedDays, effortLabel, DISPLAY_ORDER, muscleLabel, weeklyRange, ExerciseBank,
  type Effort, type MuscleGroup, type ExerciseDefinition,
} from '../core';

type Step = { kind: 'effort' | 'days' | 'muscles' | 'name' } | { kind: 'exercises'; i: number };

const effortBlurb: Record<Effort, string> = {
  minimal: 'Maintain and stay consistent on a tight schedule.',
  optimal: 'The best growth-per-hour tradeoff. Most people, most of the time.',
  maximal: 'Everything you can productively recover from.',
};

export function WizardScreen() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>({ kind: 'effort' });
  const [effort, setEffort] = useState<Effort>('optimal');
  const [days, setDays] = useState(0);
  const [muscles, setMuscles] = useState<MuscleGroup[]>([]);
  const [picked, setPicked] = useState<Map<MuscleGroup, ExerciseDefinition[]>>(new Map());
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const totalSteps = 4 + Math.max(muscles.length, 1);
  const stepIndex =
    step.kind === 'effort' ? 0
    : step.kind === 'days' ? 1
    : step.kind === 'muscles' ? 2
    : step.kind === 'exercises' ? 3 + step.i
    : 3 + muscles.length; // name

  const progress = (stepIndex + 1) / totalSteps;

  const pickedFor = (m: MuscleGroup) => picked.get(m) ?? [];
  const togglePick = (m: MuscleGroup, ex: ExerciseDefinition) => {
    setPicked((prev) => {
      const next = new Map(prev);
      const cur = next.get(m) ?? [];
      next.set(m, cur.some((e) => e.id === ex.id) ? cur.filter((e) => e.id !== ex.id) : [...cur, ex]);
      return next;
    });
  };

  const canAdvance = useMemo(() => {
    switch (step.kind) {
      case 'effort': return true;
      case 'days': return days !== 0;
      case 'muscles': return muscles.length > 0;
      case 'exercises': return pickedFor(muscles[step.i]).length > 0;
      case 'name': return name.trim().length > 0;
    }
  }, [step, days, muscles, picked, name]);

  const nextLabel = step.kind === 'name' ? 'Build my program' : 'Continue';

  const back = () => {
    switch (step.kind) {
      case 'effort': navigate(-1); break;
      case 'days': setStep({ kind: 'effort' }); break;
      case 'muscles': setStep({ kind: 'days' }); break;
      case 'exercises': setStep(step.i === 0 ? { kind: 'muscles' } : { kind: 'exercises', i: step.i - 1 }); break;
      case 'name': setStep({ kind: 'exercises', i: muscles.length - 1 }); break;
    }
  };

  const next = async () => {
    switch (step.kind) {
      case 'effort': setStep({ kind: 'days' }); break;
      case 'days': setStep({ kind: 'muscles' }); break;
      case 'muscles': setStep({ kind: 'exercises', i: 0 }); break;
      case 'exercises':
        if (step.i < muscles.length - 1) setStep({ kind: 'exercises', i: step.i + 1 });
        else { setName(`${days}-Day ${effortLabel(effort)}`); setStep({ kind: 'name' }); }
        break;
      case 'name': await build(); break;
    }
  };

  const build = async () => {
    if (!user || busy) return;
    setBusy(true);
    try {
      const selections = new Map<MuscleGroup, ExerciseDefinition[]>();
      for (const m of muscles) selections.set(m, pickedFor(m));
      const id = await createProgram(user.uid, { name: name.trim(), effort, days, selections });
      navigate(`/program/${id}`);
    } catch (err) {
      console.error('failed to build program', err);
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col bg-base">
      <div className="flex flex-col gap-3 p-5">
        <div className="flex items-center justify-between">
          <button
            aria-label="back"
            onClick={back}
            className="h-9 w-9 rounded-xl border border-stroke-strong text-ink"
          >
            ‹
          </button>
          <Eyebrow>STEP {stepIndex + 1} OF {totalSteps}</Eyebrow>
        </div>
        <div className="h-1 rounded-full bg-stroke">
          <div className="h-1 rounded-full bg-accent transition-all" style={{ width: `${progress * 100}%` }} />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        {step.kind === 'effort' && (
          <Section title="How hard do you want to push?" sub="This sets your weekly training volume per muscle.">
            {ALL_EFFORTS.map((e) => {
              const r = weeklyRange('chest', e);
              return (
                <OptionCard key={e} selected={effort === e} onClick={() => { setEffort(e); if (!allowedDays(e).includes(days)) setDays(0); }}>
                  <div className="flex items-baseline justify-between">
                    <span className="text-[18px] font-extrabold text-ink">{effortLabel(e)}</span>
                    <span className="text-[12px] font-extrabold text-accent">~{r.low}–{r.high} sets / muscle / week</span>
                  </div>
                  <p className="mt-1 text-[13px] text-ink-dim">{effortBlurb[e]}</p>
                </OptionCard>
              );
            })}
          </Section>
        )}

        {step.kind === 'days' && (
          <Section title="How many days can you train?" sub="Days, not weekdays — miss one and the plan just waits.">
            <div className="flex flex-wrap gap-2">
              {allowedDays(effort).map((d) => (
                <button
                  key={d}
                  onClick={() => setDays(d)}
                  className={`min-w-[56px] flex-1 rounded-2xl border py-4 text-[24px] font-extrabold ${
                    days === d ? 'border-accent bg-accent/10 text-accent' : 'border-stroke bg-card text-ink'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </Section>
        )}

        {step.kind === 'muscles' && (
          <Section title="What do you want to train?" sub="Pick every muscle group this program should cover.">
            <div className="flex flex-wrap gap-2">
              {DISPLAY_ORDER.map((m) => {
                const on = muscles.includes(m);
                return (
                  <button
                    key={m}
                    onClick={() =>
                      setMuscles(on ? muscles.filter((x) => x !== m) : DISPLAY_ORDER.filter((x) => muscles.includes(x) || x === m))
                    }
                    className={`rounded-full border px-4 py-3 text-[14px] font-bold ${
                      on ? 'border-accent bg-accent/10 text-accent' : 'border-stroke bg-card text-ink'
                    }`}
                  >
                    {muscleLabel(m)}
                  </button>
                );
              })}
            </div>
          </Section>
        )}

        {step.kind === 'exercises' && (
          <Section
            title={muscleLabel(muscles[step.i])}
            sub="Pick the lifts you actually want to do. More picks = more variety."
            eyebrow={`MUSCLE ${step.i + 1} OF ${muscles.length}`}
          >
            {ExerciseBank.exercisesFor(muscles[step.i]).map((ex) => {
              const on = pickedFor(muscles[step.i]).some((e) => e.id === ex.id);
              return (
                <OptionCard key={ex.id} selected={on} onClick={() => togglePick(muscles[step.i], ex)}>
                  <div className="flex items-center gap-3">
                    <span className={on ? 'text-accent' : 'text-ink-faint'}>{on ? '☑' : '☐'}</span>
                    <div>
                      <p className="text-[15px] font-bold text-ink">{ex.name}</p>
                      <p className="text-[12px] text-ink-faint">{ex.repRange} reps</p>
                    </div>
                  </div>
                </OptionCard>
              );
            })}
          </Section>
        )}

        {step.kind === 'name' && (
          <Section title="Name your program" sub="You can rename it anytime.">
            <input
              aria-label="program name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-card border border-stroke bg-input p-4 text-[20px] font-extrabold text-ink"
            />
          </Section>
        )}
      </div>

      <div className="p-5">
        <button
          onClick={next}
          disabled={!canAdvance || busy}
          className="w-full rounded-btn bg-accent py-4 text-[15px] font-extrabold text-on-accent disabled:opacity-40"
        >
          {busy ? 'Building…' : nextLabel}
        </button>
      </div>
    </div>
  );
}

function Section({ title, sub, eyebrow, children }: { title: string; sub: string; eyebrow?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4">
      {eyebrow && <Eyebrow className="text-accent">{eyebrow}</Eyebrow>}
      <div>
        <h1 className="text-[28px] font-extrabold text-ink">{title}</h1>
        <p className="mt-2 text-[13px] text-ink-dim">{sub}</p>
      </div>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  );
}

function OptionCard({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`w-full rounded-card border p-4 text-left ${selected ? 'border-accent bg-accent/10' : 'border-stroke bg-card'}`}
    >
      {children}
    </button>
  );
}
```
Add the missing import at the top (Eyebrow is used by the helpers):
```tsx
import { Eyebrow } from '../ui/Eyebrow';
```

- [ ] **Step 2: Write the failing test `web/src/screens/WizardScreen.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { test, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

const createProgram = vi.fn().mockResolvedValue('new-id');
const navigate = vi.fn();
vi.mock('../auth/useAuth', () => ({ useAuth: () => ({ user: { uid: 'u1' } }) }));
vi.mock('../data/programs', () => ({ createProgram: (...a: unknown[]) => createProgram(...a) }));
vi.mock('react-router-dom', async (orig) => ({
  ...(await orig<typeof import('react-router-dom')>()),
  useNavigate: () => navigate,
}));

import { WizardScreen } from './WizardScreen';

beforeEach(() => { createProgram.mockClear(); navigate.mockClear(); });

test('walks the steps and builds a named, active program', async () => {
  const u = userEvent.setup();
  render(<MemoryRouter><WizardScreen /></MemoryRouter>);

  // effort defaults to optimal → Continue
  await u.click(screen.getByRole('button', { name: 'Continue' }));
  // days: pick 4
  await u.click(screen.getByRole('button', { name: '4' }));
  await u.click(screen.getByRole('button', { name: 'Continue' }));
  // muscles: pick Chest
  await u.click(screen.getByRole('button', { name: 'Chest' }));
  await u.click(screen.getByRole('button', { name: 'Continue' }));
  // exercises for chest: pick the first
  await u.click(screen.getByText('Barbell Bench Press'));
  await u.click(screen.getByRole('button', { name: 'Continue' }));
  // name step: default filled
  const nameField = screen.getByLabelText('program name') as HTMLInputElement;
  expect(nameField.value).toBe('4-Day Optimal');
  await u.click(screen.getByRole('button', { name: 'Build my program' }));

  expect(createProgram).toHaveBeenCalledTimes(1);
  const [uid, input] = createProgram.mock.calls[0];
  expect(uid).toBe('u1');
  expect(input.name).toBe('4-Day Optimal');
  expect(input.effort).toBe('optimal');
  expect(input.days).toBe(4);
  expect(input.selections.get('chest')).toHaveLength(1);
  expect(navigate).toHaveBeenCalledWith('/program/new-id');
});
```

- [ ] **Step 3: Run tests + typecheck**

Run: `npm --prefix web run test` → the wizard test passes (plus all prior). Run `npm --prefix web run typecheck` → exit 0.

- [ ] **Step 4: Commit**

```bash
git add web/src/screens/WizardScreen.tsx web/src/screens/WizardScreen.test.tsx
git commit -m "feat(web): program-building wizard with name step"
```

---

### Task 5: Program detail screen

**Files:**
- Modify: `web/src/screens/ProgramDetailScreen.tsx` (replace placeholder)
- Test: `web/src/screens/ProgramDetailScreen.test.tsx`

**Interfaces:**
- Consumes: `useAuth`; `useProgram`, `setActiveProgram`, `renameProgram`, `deleteProgram` (`../data/programs`); `dayFocus` (`../data/materialize`); `effortLabel` (`../core`); `useParams`, `useNavigate`, `Link` (react-router); `Eyebrow`.
- Produces: `ProgramDetailScreen`.

- [ ] **Step 1: Write `web/src/screens/ProgramDetailScreen.tsx`**

```tsx
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { useProgram, setActiveProgram, renameProgram, deleteProgram } from '../data/programs';
import { dayFocus } from '../data/materialize';
import { effortLabel } from '../core';
import { Eyebrow } from '../ui/Eyebrow';

export function ProgramDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { program, loading } = useProgram(user?.uid, id);

  const [renaming, setRenaming] = useState(false);
  const [nameBuf, setNameBuf] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (loading) return <main className="p-6 text-ink-faint">Loading…</main>;
  if (!program || !user || !id) return <main className="p-6 text-ink-dim">Program not found.</main>;

  const commitRename = () => {
    const trimmed = nameBuf.trim();
    if (trimmed && trimmed !== program.name) renameProgram(user.uid, id, trimmed).catch((e) => console.error(e));
    setRenaming(false);
  };

  return (
    <main className="flex flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <Eyebrow className={program.isActive ? 'text-accent' : undefined}>
          {program.isActive ? 'ACTIVE PROGRAM' : 'PROGRAM'}
        </Eyebrow>
        {!program.isActive && (
          <button
            onClick={() => setActiveProgram(user.uid, id).catch((e) => console.error(e))}
            className="rounded-full border border-accent/40 bg-accent/10 px-3 py-1.5 text-[12px] font-extrabold text-accent"
          >
            Make active
          </button>
        )}
      </div>

      {renaming ? (
        <input
          aria-label="program name"
          autoFocus
          value={nameBuf}
          onChange={(e) => setNameBuf(e.target.value)}
          onBlur={commitRename}
          onKeyDown={(e) => e.key === 'Enter' && commitRename()}
          className="rounded-card border border-stroke bg-input p-2 text-[30px] font-extrabold text-ink"
        />
      ) : (
        <button
          onClick={() => { setNameBuf(program.name); setRenaming(true); }}
          className="flex items-center gap-2 text-left"
        >
          <span className="text-[30px] font-extrabold text-ink">{program.name}</span>
          <span className="text-[15px] text-ink-faint">✎</span>
        </button>
      )}

      <p className="text-[13px] text-ink-dim">
        {effortLabel(program.effort)} effort · {program.daysPerWeek} days · {program.muscles.length} muscle groups
      </p>

      {[...program.days]
        .sort((a, b) => a.index - b.index)
        .map((day) => {
          const sets = day.lifts.reduce((s, l) => s + l.targetSets, 0);
          return (
            <Link
              key={day.index}
              to={`/program/${id}/day/${day.index}`}
              className="flex items-center gap-4 rounded-card border border-stroke bg-card p-4"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-input text-[17px] font-extrabold text-ink">
                {day.index + 1}
              </span>
              <div className="flex-1">
                <p className="text-[15px] font-bold text-ink">{dayFocus(day.lifts) || 'Rest / empty'}</p>
                <p className="text-[12px] text-ink-dim">{day.lifts.length} lifts · {sets} sets</p>
              </div>
            </Link>
          );
        })}

      {confirmDelete ? (
        <div className="rounded-card border border-red-500/40 p-4">
          <p className="text-[13px] text-ink">Delete “{program.name}”? Logged workouts are kept.</p>
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => deleteProgram(user.uid, id).then(() => navigate('/program')).catch((e) => console.error(e))}
              className="rounded-btn bg-red-500/90 px-4 py-2 text-[13px] font-bold text-white"
            >
              Delete
            </button>
            <button onClick={() => setConfirmDelete(false)} className="px-4 py-2 text-[13px] font-bold text-ink-dim">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setConfirmDelete(true)}
          className="mt-2 rounded-btn border border-red-500/40 py-3 text-[14px] font-bold text-red-400"
        >
          Delete program
        </button>
      )}
    </main>
  );
}
```

- [ ] **Step 2: Write the failing test `web/src/screens/ProgramDetailScreen.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { test, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

const useProgram = vi.fn();
const setActiveProgram = vi.fn().mockResolvedValue(undefined);
const renameProgram = vi.fn().mockResolvedValue(undefined);
const deleteProgram = vi.fn().mockResolvedValue(undefined);
vi.mock('../auth/useAuth', () => ({ useAuth: () => ({ user: { uid: 'u1' } }) }));
vi.mock('../data/programs', () => ({
  useProgram: (...a: unknown[]) => useProgram(...a),
  setActiveProgram: (...a: unknown[]) => setActiveProgram(...a),
  renameProgram: (...a: unknown[]) => renameProgram(...a),
  deleteProgram: (...a: unknown[]) => deleteProgram(...a),
}));

import { ProgramDetailScreen } from './ProgramDetailScreen';

const program = {
  id: 'p1', name: '4-Day Optimal', effort: 'optimal', muscles: ['chest'], isActive: false, daysPerWeek: 4,
  days: [{ index: 0, completedInCycle: false, lifts: [{ order: 0, muscle: 'chest', exerciseId: 'bench', exerciseName: 'Bench', repRange: '5-8', targetSets: 3 }] }],
};

function renderAt() {
  return render(
    <MemoryRouter initialEntries={['/program/p1']}>
      <Routes><Route path="/program/:id" element={<ProgramDetailScreen />} /></Routes>
    </MemoryRouter>,
  );
}
beforeEach(() => { setActiveProgram.mockClear(); renameProgram.mockClear(); deleteProgram.mockClear(); });

test('make active calls setActiveProgram for an inactive program', async () => {
  useProgram.mockReturnValue({ program, loading: false });
  renderAt();
  await userEvent.click(screen.getByRole('button', { name: 'Make active' }));
  expect(setActiveProgram).toHaveBeenCalledWith('u1', 'p1');
});

test('rename commits a trimmed non-empty name', async () => {
  useProgram.mockReturnValue({ program, loading: false });
  renderAt();
  await userEvent.click(screen.getByText('4-Day Optimal'));
  const field = screen.getByLabelText('program name');
  await userEvent.clear(field);
  await userEvent.type(field, 'Push Pull{Enter}');
  expect(renameProgram).toHaveBeenCalledWith('u1', 'p1', 'Push Pull');
});

test('delete asks for confirmation then deletes', async () => {
  useProgram.mockReturnValue({ program, loading: false });
  renderAt();
  await userEvent.click(screen.getByRole('button', { name: 'Delete program' }));
  await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
  expect(deleteProgram).toHaveBeenCalledWith('u1', 'p1');
});
```

- [ ] **Step 3: Run tests + typecheck**

Run: `npm --prefix web run test` → PASS. Run `npm --prefix web run typecheck` → exit 0.

- [ ] **Step 4: Commit**

```bash
git add web/src/screens/ProgramDetailScreen.tsx web/src/screens/ProgramDetailScreen.test.tsx
git commit -m "feat(web): program detail screen (make-active, rename, delete)"
```

---

### Task 6: Day detail screen (view + edit)

**Files:**
- Modify: `web/src/screens/DayDetailScreen.tsx` (replace placeholder)
- Test: `web/src/screens/DayDetailScreen.test.tsx`

**Interfaces:**
- Consumes: `useAuth`; `useProgram`, `updateProgramDays` (`../data/programs`); `dayFocus` (`../data/materialize`); `ExerciseBank`, `muscleLabel`, `MuscleGroup` (`../core`); `useParams`; `ProgramDayDoc`, `PlannedLiftDoc` (`../data/types`); `Eyebrow`.
- Produces: `DayDetailScreen`. All edits build the full updated `days` array and call `updateProgramDays(uid, id, days)`.

- [ ] **Step 1: Write `web/src/screens/DayDetailScreen.tsx`**

```tsx
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { useProgram, updateProgramDays } from '../data/programs';
import { dayFocus } from '../data/materialize';
import { ExerciseBank, muscleLabel, type MuscleGroup } from '../core';
import type { ProgramDayDoc, PlannedLiftDoc } from '../data/types';
import { Eyebrow } from '../ui/Eyebrow';

export function DayDetailScreen() {
  const { id, dayIndex } = useParams<{ id: string; dayIndex: string }>();
  const { user } = useAuth();
  const { program, loading } = useProgram(user?.uid, id);
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);

  if (loading) return <main className="p-6 text-ink-faint">Loading…</main>;
  if (!program || !user || !id) return <main className="p-6 text-ink-dim">Not found.</main>;
  const idx = Number(dayIndex);
  const day = program.days.find((d) => d.index === idx);
  if (!day) return <main className="p-6 text-ink-dim">Day not found.</main>;

  const lifts = [...day.lifts].sort((a, b) => a.order - b.order);
  const sets = lifts.reduce((s, l) => s + l.targetSets, 0);

  // Persist a mutated lift list for this day: re-index order, splice into days, save.
  const saveLifts = (nextLifts: PlannedLiftDoc[]) => {
    const reindexed = nextLifts.map((l, i) => ({ ...l, order: i }));
    const nextDays: ProgramDayDoc[] = program.days.map((d) => (d.index === idx ? { ...d, lifts: reindexed } : d));
    updateProgramDays(user.uid, id, nextDays).catch((e) => console.error('failed to save day', e));
  };

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= lifts.length) return;
    const copy = [...lifts];
    [copy[i], copy[j]] = [copy[j], copy[i]];
    saveLifts(copy);
  };
  const setSets = (i: number, n: number) =>
    saveLifts(lifts.map((l, k) => (k === i ? { ...l, targetSets: Math.max(1, Math.min(10, n)) } : l)));
  const remove = (i: number) => saveLifts(lifts.filter((_, k) => k !== i));
  const swap = (i: number, exId: string) => {
    const ex = ExerciseBank.find(exId);
    if (!ex) return;
    saveLifts(lifts.map((l, k) => (k === i ? { ...l, exerciseId: ex.id, exerciseName: ex.name, muscle: ex.primary, repRange: ex.repRange } : l)));
  };
  const add = (exId: string) => {
    const ex = ExerciseBank.find(exId);
    if (!ex) return;
    saveLifts([...lifts, { order: lifts.length, exerciseId: ex.id, exerciseName: ex.name, muscle: ex.primary, repRange: ex.repRange, targetSets: 3 }]);
    setAdding(false);
  };

  return (
    <main className="flex flex-col gap-4 p-6">
      <div className="flex items-start justify-between">
        <div>
          <Eyebrow className="text-accent">DAY {idx + 1}</Eyebrow>
          <h1 className="text-[30px] font-extrabold text-ink">{dayFocus(lifts) || 'Empty day'}</h1>
          <p className="text-[13px] text-ink-dim">{lifts.length} lifts · {sets} sets</p>
        </div>
        <button onClick={() => setEditing((v) => !v)} className="text-[14px] font-bold text-accent">
          {editing ? 'Done' : 'Edit'}
        </button>
      </div>

      {lifts.map((lift, i) => (
        <div key={`${lift.exerciseId}-${i}`} className="rounded-card border border-stroke bg-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[15px] font-bold text-ink">{lift.exerciseName}</p>
              <p className="text-[12px] text-ink-faint">{lift.targetSets} sets · {lift.repRange} reps · {muscleLabel(lift.muscle)}</p>
            </div>
            {editing && (
              <div className="flex items-center gap-1">
                <button aria-label={`up-${i}`} disabled={i === 0} onClick={() => move(i, -1)} className="h-8 w-8 rounded-lg border border-stroke-strong text-ink disabled:opacity-30">↑</button>
                <button aria-label={`down-${i}`} disabled={i === lifts.length - 1} onClick={() => move(i, 1)} className="h-8 w-8 rounded-lg border border-stroke-strong text-ink disabled:opacity-30">↓</button>
                <button aria-label={`delete-${i}`} onClick={() => remove(i)} className="h-8 w-8 rounded-lg border border-stroke-strong text-ink-dim">✕</button>
              </div>
            )}
          </div>
          {editing && (
            <div className="mt-3 flex items-center gap-3">
              <div className="flex items-center gap-2">
                <button aria-label={`sets-minus-${i}`} onClick={() => setSets(i, lift.targetSets - 1)} className="h-8 w-8 rounded-lg border border-stroke-strong text-ink">−</button>
                <span className="min-w-[52px] text-center text-[12px] font-extrabold text-ink">{lift.targetSets} sets</span>
                <button aria-label={`sets-plus-${i}`} onClick={() => setSets(i, lift.targetSets + 1)} className="h-8 w-8 rounded-lg border border-stroke-strong text-ink">+</button>
              </div>
              <select
                aria-label={`swap-${i}`}
                value={lift.exerciseId}
                onChange={(e) => swap(i, e.target.value)}
                className="rounded-lg border border-stroke-strong bg-input px-2 py-1 text-[12px] font-bold text-ink"
              >
                {ExerciseBank.exercisesFor(lift.muscle).map((alt) => (
                  <option key={alt.id} value={alt.id}>{alt.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      ))}

      {editing && (
        adding ? (
          <div className="rounded-card border border-stroke bg-card p-4">
            <Eyebrow>Add a lift</Eyebrow>
            <div className="mt-2 flex flex-col gap-2">
              {program.muscles.map((m: MuscleGroup) => (
                <div key={m}>
                  <p className="text-[11px] font-extrabold uppercase tracking-[1px] text-accent">{muscleLabel(m)}</p>
                  {ExerciseBank.exercisesFor(m).map((ex) => (
                    <button key={ex.id} onClick={() => add(ex.id)} className="flex w-full items-center justify-between py-1.5 text-left">
                      <span className="text-[14px] text-ink">{ex.name}</span>
                      <span className="text-[13px] font-extrabold text-accent">+ Add</span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
            <button onClick={() => setAdding(false)} className="mt-2 text-[13px] font-bold text-ink-dim">Close</button>
          </div>
        ) : (
          <button onClick={() => setAdding(true)} className="rounded-btn border border-dashed border-stroke-strong py-3 text-[14px] font-bold text-ink">
            + Add a lift
          </button>
        )
      )}
    </main>
  );
}
```

- [ ] **Step 2: Write the failing test `web/src/screens/DayDetailScreen.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { test, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

const useProgram = vi.fn();
const updateProgramDays = vi.fn().mockResolvedValue(undefined);
vi.mock('../auth/useAuth', () => ({ useAuth: () => ({ user: { uid: 'u1' } }) }));
vi.mock('../data/programs', () => ({
  useProgram: (...a: unknown[]) => useProgram(...a),
  updateProgramDays: (...a: unknown[]) => updateProgramDays(...a),
}));

import { DayDetailScreen } from './DayDetailScreen';

const program = {
  id: 'p1', name: 'X', effort: 'optimal', muscles: ['chest'], isActive: true, daysPerWeek: 1,
  days: [{
    index: 0, completedInCycle: false, lifts: [
      { order: 0, muscle: 'chest', exerciseId: 'bench-press', exerciseName: 'Barbell Bench Press', repRange: '5-8', targetSets: 3 },
      { order: 1, muscle: 'chest', exerciseId: 'incline-db-press', exerciseName: 'Incline Dumbbell Press', repRange: '8-12', targetSets: 3 },
    ],
  }],
};

function renderAt() {
  useProgram.mockReturnValue({ program, loading: false });
  return render(
    <MemoryRouter initialEntries={['/program/p1/day/0']}>
      <Routes><Route path="/program/:id/day/:dayIndex" element={<DayDetailScreen />} /></Routes>
    </MemoryRouter>,
  );
}
beforeEach(() => updateProgramDays.mockClear());

test('view mode shows the day focus and lifts', () => {
  renderAt();
  expect(screen.getByRole('heading', { name: 'Chest' })).toBeInTheDocument();
  expect(screen.getByText('Barbell Bench Press')).toBeInTheDocument();
});

test('increasing sets saves a reindexed days array', async () => {
  renderAt();
  await userEvent.click(screen.getByRole('button', { name: 'Edit' }));
  await userEvent.click(screen.getByLabelText('sets-plus-0'));
  expect(updateProgramDays).toHaveBeenCalledTimes(1);
  const [uid, pid, days] = updateProgramDays.mock.calls[0];
  expect(uid).toBe('u1');
  expect(pid).toBe('p1');
  expect(days[0].lifts[0].targetSets).toBe(4);
  expect(days[0].lifts.map((l: { order: number }) => l.order)).toEqual([0, 1]);
});

test('deleting a lift removes it and re-indexes order', async () => {
  renderAt();
  await userEvent.click(screen.getByRole('button', { name: 'Edit' }));
  await userEvent.click(screen.getByLabelText('delete-0'));
  const days = updateProgramDays.mock.calls[0][2];
  expect(days[0].lifts).toHaveLength(1);
  expect(days[0].lifts[0].exerciseName).toBe('Incline Dumbbell Press');
  expect(days[0].lifts[0].order).toBe(0);
});
```

- [ ] **Step 3: Run tests + typecheck**

Run: `npm --prefix web run test` → PASS. Run `npm --prefix web run typecheck` → exit 0.

- [ ] **Step 4: Commit**

```bash
git add web/src/screens/DayDetailScreen.tsx web/src/screens/DayDetailScreen.test.tsx
git commit -m "feat(web): day detail view + edit (reorder, swap, set-count, add, delete)"
```

---

### Task 7: Full-suite verification & build

**Files:** none (verification + any glue fixes).

- [ ] **Step 1: Run the default test tier**

Run: `npm --prefix web run test`
Expected: all suites green (engine + Plan 2 + materialize + library + wizard + program-detail + day-detail).

- [ ] **Step 2: Run the emulator test tier**

Run: `npm --prefix web run test:emulator`
Expected: rules + profile + programs emulator tests pass.

- [ ] **Step 3: Typecheck + production build**

Run: `npm --prefix web run typecheck` → exit 0.
Run: `npm --prefix web run build` → succeeds, emits `dist/` (with manifest + sw from Plan 2).

- [ ] **Step 4: Confirm no placeholder screens remain**

Run: `grep -rn "Task 4\|Task 5\|Task 6\|coming in Plan 3" web/src/screens/*.tsx`
Expected: only `TodayScreen.tsx` / `ProgramScreen`-style placeholders that are intentionally deferred to 3b (Today). The Wizard/ProgramDetail/DayDetail placeholders from Task 3 must be gone (replaced by Tasks 4–6). If any remain, the corresponding task didn't land — fix before finishing.

- [ ] **Step 5: Commit (only if Step 4 required a glue fix; otherwise nothing to commit)**

```bash
git add -A && git commit -m "chore(web): plan 3a verification glue" || echo "nothing to commit"
```

---

## Self-Review

**1. Spec coverage (against `2026-08-05-riptide-pwa-3a-programs.md`):**
- §3 schema (`ProgramDoc` +effort/+muscles, `ProgramDayDoc` -focus) + `dayFocus` → Task 1.
- §4 `materialize` (+`toGeneratorInput`, `NewProgramInput`) → Task 1.
- §5 repository (create/setActive/rename/delete/updateProgramDays) + hooks (usePrograms/useProgram/useActiveProgram) → Task 2.
- §6.1 Wizard incl. the added name step + default → Task 4.
- §6.2 Program library + empty state + New program → Task 3.
- §6.3 Program detail (make-active/rename/delete) → Task 5.
- §6.4 Day detail view + edit (reorder/swap/add/delete/set-count) → Task 6.
- §7 routing (/program, /program/:id, /program/:id/day/:dayIndex, /wizard; Today stays placeholder) → Task 3 (+ Task 4 nav).
- §8 single-active (batch), edit-by-rewrite, delete-preserves-history (structural) → Tasks 2, 6.
- §9 testing: materialize unit (T1), programs emulator (T2), component tests for every screen (T3–T6), full-suite gate (T7).

**2. Placeholder scan:** Task 3 intentionally creates *temporary* screen placeholders so the router compiles; Tasks 4–6 replace them and Task 7 Step 4 asserts none survive. No "TBD"/"add error handling"/vague steps; every code step has complete code; commands have expected output.

**3. Type consistency:** `NewProgramInput`/`toGeneratorInput`/`materialize` signatures match across Tasks 1, 2, 4. `ProgramWithId` shape and hook return types (`{ programs|program, loading }`) consistent between `programs.ts` (T2) and every consumer (T3–T6). `updateProgramDays(uid, id, days: ProgramDayDoc[])` used identically in Task 6. Route param names (`id`, `dayIndex`) match between `App.tsx` (T3) and `useParams` in Tasks 5–6. `dayFocus(lifts)` signature consistent (T1 → T3/T5/T6). Engine imports (`generate`, `DISPLAY_ORDER`, `muscleLabel`, `weeklyRange`, `allowedDays`, `effortLabel`, `ALL_EFFORTS`, `ExerciseBank`) all exist in the Plan 1 barrel.

**Out of scope (Plan 3b):** Today cycle logic, sessions/loggedSets, Day live mode + logging, Lift detail, History, rest timer.
```
