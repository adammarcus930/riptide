# Riptide PWA — Plan 3b: Training & Logging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the app — the `sessions` + `loggedSets` data layer, the Today screen, live workout logging (Day live mode + Lift detail with cross-program prefill + a foreground rest timer), cycle/complete-day tracking, and History. Faithful port of the Swift training loop. Emulator-first.

**Architecture:** A new `data/workouts.ts` (repository writes + `onSnapshot` hooks, mirroring Swift `HistoryQueries`/`SetLogger`) over the flat `sessions`/`loggedSets` collections. `toggleSet` lazily creates the day's session (closing stragglers to keep at-most-one-open) and adds/removes a logged set, tracking a denormalized `setCount`. Screens: Today (replaces placeholder), Day detail gains a live mode beside 3a's edit mode, a new Lift detail screen, and History. A `useRestTimer` hook drives the foreground countdown.

**Tech Stack:** unchanged (React 18 + TS strict + Vite + Tailwind + React Router 6 + Firebase 10; Vitest + RTL default tier; emulator tier via `test:emulator`). Engine from `web/src/core`.

## Global Constraints

- **Node 20+**, npm via `npm --prefix web …` (never `cd`); npm scripts run with cwd `web/`.
- **Engine (`web/src/core`) imported, never modified.** Reactive pattern from `data/programs.ts`: repository async writes; `onSnapshot` read hooks each with an `(err)=>{console.error(...);setLoading(false)}` callback; docs read as `{ id, ...data }`.
- **Two test tiers:** default `npm --prefix web run test` (jsdom, hermetic, excludes `**/*.emulator.test.*`) is the gate for every task; `npm --prefix web run test:emulator` runs `*.emulator.test.ts` against the Firestore+Auth emulators (OpenJDK installed; project `demo-riptide`). Emulator tests authenticate through the `../firebase` singleton with `vi.stubEnv('VITE_USE_EMULATOR','1')` set before importing (the pattern proven in `programs.emulator.test.ts`).
- **No new composite indexes.** Query shapes are chosen to need only single-field indexes plus the already-declared `loggedSets` composite (`exerciseId ASC` + `loggedAt DESC`): `useOpenSession` uses `where('finishedAt','==',null) limit(1)` (no orderBy — the invariant guarantees ≤1); `useHistory` uses `orderBy('startedAt','desc')` and filters `finishedAt != null` client-side; `useSessionSets` uses `where('sessionId','==',id)`; `lastSets` uses the declared composite. Multiple `==` filters need no composite index.
- **At-most-one-open-session** is a write-path invariant in `toggleSet` (close stragglers before creating a new session) — port of `SetLogger`.
- **Rest timer is foreground-only** (visual countdown flipping to accent at `restAlertSec`); no notifications, no wake lock.
- **Ice-palette tokens** + `ui/` primitives; faithful port of the Swift screens.

## File Structure

```
web/src/
  data/
    types.ts        # MODIFY: SessionDoc + setCount (Task 1)
    paths.ts        # MODIFY: sessionDoc, loggedSetDoc (Task 1)
    workouts.ts     # NEW: sessions/loggedSets hooks + toggleSet (T1); completeDay/startNextCycle/lastSets/mergedBySetIndex/useHistory (T2)
    __tests__/
      workouts.emulator.test.ts   # T1 (toggle) + T2 (completeDay/cycle/lastSets/history)
      mergedBySetIndex.test.ts     # T2 (pure)
  hooks/
    useRestTimer.ts       # NEW (T3)
    useRestTimer.test.ts  # T3
  screens/
    TodayScreen.tsx        # REPLACE placeholder (T4) + test
    DayDetailScreen.tsx    # MODIFY: add live mode (T5) + test
    LiftDetailScreen.tsx   # NEW (T6) + test
    HistoryScreen.tsx      # NEW (T7) + test
    MoreScreen.tsx         # MODIFY: add History link (T7)
  App.tsx                  # MODIFY: lift + history routes (T6, T7)
```

---

### Task 1: Sessions/loggedSets data layer — reads + `toggleSet`

**Files:**
- Modify: `web/src/data/types.ts`, `web/src/data/paths.ts`
- Create: `web/src/data/workouts.ts`
- Test: `web/src/data/__tests__/workouts.emulator.test.ts`

**Interfaces:**
- Consumes: `db` (`../firebase`); `sessionsCol`, `loggedSetsCol`, `sessionDoc`, `loggedSetDoc` (`./paths`); `SessionDoc`, `LoggedSetDoc` (`./types`).
- Produces:
  - `SessionDoc` gains `setCount: number`.
  - `sessionDoc(uid,id)`, `loggedSetDoc(uid,id)` path helpers.
  - `type SessionWithId = SessionDoc & { id: string }`, `type LoggedSetWithId = LoggedSetDoc & { id: string }`.
  - `useOpenSession(uid): { session: SessionWithId | null; loading }`.
  - `useSessionSets(uid, sessionId: string | undefined): { sets: LoggedSetWithId[]; loading }`.
  - `interface ToggleSetParams { programId; programName; dayIndex; exerciseId; exerciseName; setIndex; weight; reps }` and `toggleSet(uid, p): Promise<void>`.

- [ ] **Step 1: Add `setCount` to `SessionDoc` in `web/src/data/types.ts`**

Change the `SessionDoc` interface to:
```ts
export interface SessionDoc {
  programId: string;
  programName: string;
  dayIndex: number;
  startedAt: number;
  finishedAt: number | null;
  setCount: number;
}
```
(Leave all other interfaces unchanged.)

- [ ] **Step 2: Add path helpers to `web/src/data/paths.ts`**

Append:
```ts
export const sessionDoc = (uid: string, id: string) => doc(db, 'users', uid, 'sessions', id);
export const loggedSetDoc = (uid: string, id: string) => doc(db, 'users', uid, 'loggedSets', id);
```

- [ ] **Step 3: Write the failing emulator test `web/src/data/__tests__/workouts.emulator.test.ts`**

```ts
import { beforeAll, afterEach, afterAll, test, expect, vi } from 'vitest';

vi.stubEnv('VITE_USE_EMULATOR', '1');

import { getAuth, signInAnonymously } from 'firebase/auth';
import { getDocs, collection, deleteDoc } from 'firebase/firestore';

let uid: string;
let db: typeof import('../../firebase').db;

beforeAll(async () => {
  const fb = await import('../../firebase');
  db = fb.db;
  uid = (await signInAnonymously(getAuth(fb.app))).user.uid;
});
afterEach(async () => {
  for (const c of ['sessions', 'loggedSets']) {
    const snap = await getDocs(collection(db, 'users', uid, c));
    await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
  }
});
afterAll(() => vi.unstubAllEnvs());

const params = (over: Partial<import('../workouts').ToggleSetParams> = {}) => ({
  programId: 'p1', programName: 'Prog', dayIndex: 0,
  exerciseId: 'bench-press', exerciseName: 'Bench', setIndex: 0, weight: 100, reps: 5, ...over,
});

test('toggleSet creates a session lazily and logs the set with setCount', async () => {
  const { toggleSet } = await import('../workouts');
  await toggleSet(uid, params());
  const sessions = await getDocs(collection(db, 'users', uid, 'sessions'));
  const sets = await getDocs(collection(db, 'users', uid, 'loggedSets'));
  expect(sessions.docs).toHaveLength(1);
  expect(sessions.docs[0].data().finishedAt).toBeNull();
  expect(sessions.docs[0].data().setCount).toBe(1);
  expect(sets.docs).toHaveLength(1);
});

test('toggling the same set twice removes it and decrements setCount', async () => {
  const { toggleSet } = await import('../workouts');
  await toggleSet(uid, params());
  await toggleSet(uid, params());
  const sets = await getDocs(collection(db, 'users', uid, 'loggedSets'));
  const sessions = await getDocs(collection(db, 'users', uid, 'sessions'));
  expect(sets.docs).toHaveLength(0);
  expect(sessions.docs[0].data().setCount).toBe(0);
});

test('logging for a new day closes the prior open session (at-most-one-open)', async () => {
  const { toggleSet } = await import('../workouts');
  await toggleSet(uid, params({ dayIndex: 0 }));
  await toggleSet(uid, params({ dayIndex: 1 }));
  const sessions = await getDocs(collection(db, 'users', uid, 'sessions'));
  const open = sessions.docs.filter((d) => d.data().finishedAt === null);
  expect(sessions.docs).toHaveLength(2);
  expect(open).toHaveLength(1);
  expect(open[0].data().dayIndex).toBe(1);
});
```

- [ ] **Step 4: Run the emulator test to verify it fails**

Run: `npm --prefix web run test:emulator`
Expected: FAIL — cannot resolve `../workouts`.

- [ ] **Step 5: Write `web/src/data/workouts.ts`**

```ts
import { useEffect, useState } from 'react';
import {
  onSnapshot, query, where, orderBy, limit, getDocs, doc, writeBatch, increment,
} from 'firebase/firestore';
import { db } from '../firebase';
import { sessionsCol, loggedSetsCol, sessionDoc } from './paths';
import type { SessionDoc, LoggedSetDoc } from './types';

export type SessionWithId = SessionDoc & { id: string };
export type LoggedSetWithId = LoggedSetDoc & { id: string };

// --- reactive reads ---

export function useOpenSession(uid: string | undefined): { session: SessionWithId | null; loading: boolean } {
  const [session, setSession] = useState<SessionWithId | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!uid) { setSession(null); setLoading(false); return; }
    setLoading(true);
    return onSnapshot(
      query(sessionsCol(uid), where('finishedAt', '==', null), limit(1)),
      (snap) => {
        const d = snap.docs[0];
        setSession(d ? { id: d.id, ...(d.data() as SessionDoc) } : null);
        setLoading(false);
      },
      (err) => { console.error('open session listener failed', err); setLoading(false); },
    );
  }, [uid]);
  return { session, loading };
}

export function useSessionSets(
  uid: string | undefined,
  sessionId: string | undefined,
): { sets: LoggedSetWithId[]; loading: boolean } {
  const [sets, setSets] = useState<LoggedSetWithId[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!uid || !sessionId) { setSets([]); setLoading(false); return; }
    setLoading(true);
    return onSnapshot(
      query(loggedSetsCol(uid), where('sessionId', '==', sessionId)),
      (snap) => {
        setSets(snap.docs.map((d) => ({ id: d.id, ...(d.data() as LoggedSetDoc) })));
        setLoading(false);
      },
      (err) => { console.error('session sets listener failed', err); setLoading(false); },
    );
  }, [uid, sessionId]);
  return { sets, loading };
}

// --- writes ---

export interface ToggleSetParams {
  programId: string;
  programName: string;
  dayIndex: number;
  exerciseId: string;
  exerciseName: string;
  setIndex: number;
  weight: number;
  reps: number;
}

// Port of SetLogger.toggle: resolve the open session for this day (creating it
// lazily and closing any stragglers to keep at-most-one-open), then add or
// remove the (exerciseId, setIndex) set, tracking setCount.
export async function toggleSet(uid: string, p: ToggleSetParams): Promise<void> {
  const openSnap = await getDocs(query(sessionsCol(uid), where('finishedAt', '==', null)));
  const openForDay = openSnap.docs.find((d) => (d.data() as SessionDoc).dayIndex === p.dayIndex);

  let sessionId: string;
  if (openForDay) {
    sessionId = openForDay.id;
  } else {
    const batch = writeBatch(db);
    openSnap.docs.forEach((d) => batch.update(d.ref, { finishedAt: Date.now() }));
    const ref = doc(sessionsCol(uid));
    const session: SessionDoc = {
      programId: p.programId, programName: p.programName, dayIndex: p.dayIndex,
      startedAt: Date.now(), finishedAt: null, setCount: 0,
    };
    batch.set(ref, session);
    await batch.commit();
    sessionId = ref.id;
  }

  const existing = await getDocs(
    query(
      loggedSetsCol(uid),
      where('sessionId', '==', sessionId),
      where('exerciseId', '==', p.exerciseId),
      where('setIndex', '==', p.setIndex),
    ),
  );
  const batch = writeBatch(db);
  if (!existing.empty) {
    existing.docs.forEach((d) => batch.delete(d.ref));
    batch.update(sessionDoc(uid, sessionId), { setCount: increment(-existing.size) });
  } else {
    const ref = doc(loggedSetsCol(uid));
    const set: LoggedSetDoc = {
      sessionId, exerciseId: p.exerciseId, exerciseName: p.exerciseName,
      setIndex: p.setIndex, weight: p.weight, reps: p.reps, dayIndex: p.dayIndex, loggedAt: Date.now(),
    };
    batch.set(ref, set);
    batch.update(sessionDoc(uid, sessionId), { setCount: increment(1) });
  }
  await batch.commit();
}
```

- [ ] **Step 6: Run the emulator test to verify it passes**

Run: `npm --prefix web run test:emulator`
Expected: PASS — the 3 toggle tests (plus prior programs/profile/rules). If a query needs an index the emulator will error clearly; the chosen shapes avoid new composite indexes.

- [ ] **Step 7: Default tier + typecheck**

Run: `npm --prefix web run test` → PASS (excludes the emulator test). Run `npm --prefix web run typecheck` → exit 0.

- [ ] **Step 8: Commit**

```bash
git add web/src/data/types.ts web/src/data/paths.ts web/src/data/workouts.ts web/src/data/__tests__/workouts.emulator.test.ts
git commit -m "feat(web): sessions/loggedSets data layer with toggleSet (at-most-one-open)"
```

---

### Task 2: Prefill, cycle/completion, and history

**Files:**
- Modify: `web/src/data/workouts.ts`
- Test: `web/src/data/__tests__/workouts.emulator.test.ts` (append), `web/src/data/__tests__/mergedBySetIndex.test.ts`

**Interfaces:**
- Consumes: same as Task 1, plus `getDoc`, `updateDoc` (`firebase/firestore`); `programDoc` (`./paths`); `ProgramDoc`, `ProgramDayDoc` (`./types`).
- Produces:
  - `lastSets(uid, exerciseId, excludingSessionId?): Promise<LoggedSetWithId[]>`.
  - `interface SetValue { weight: number; reps: number }` and `mergedBySetIndex(current: {setIndex;weight;reps}[], previous: {setIndex;weight;reps}[]): Map<number, SetValue>`.
  - `completeDay(uid, programId, dayIndex): Promise<void>`, `startNextCycle(uid, programId): Promise<void>`.
  - `useHistory(uid): { sessions: SessionWithId[]; loading }`.

- [ ] **Step 1: Write the pure-merge test `web/src/data/__tests__/mergedBySetIndex.test.ts`**

```ts
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
```

- [ ] **Step 2: Append emulator tests to `web/src/data/__tests__/workouts.emulator.test.ts`**

Add these tests (the `uid`, `db`, `params`, `afterEach` from Task 1 are reused; also clear `programs` in the existing `afterEach` loop — change `['sessions','loggedSets']` to `['sessions','loggedSets','programs']`):
```ts
import { doc, setDoc } from 'firebase/firestore';

test('lastSets returns the newest OTHER session for an exercise, sorted by setIndex', async () => {
  const { toggleSet, lastSets, useOpenSession } = await import('../workouts');
  // session A (day 0): two bench sets
  await toggleSet(uid, params({ setIndex: 0, weight: 100 }));
  await toggleSet(uid, params({ setIndex: 1, weight: 105 }));
  // move to day 1 → closes A, opens B; log one bench set in B
  await toggleSet(uid, params({ dayIndex: 1, setIndex: 0, weight: 110 }));
  const openB = (await getDocs(query(collection(db, 'users', uid, 'sessions'), where('finishedAt', '==', null)))).docs[0].id;
  const prev = await lastSets(uid, 'bench-press', openB);
  expect(prev.map((s) => s.setIndex)).toEqual([0, 1]); // session A's sets
  expect(prev[0].weight).toBe(100);
});

test('completeDay marks the day complete and finishes the open session', async () => {
  const { toggleSet, completeDay } = await import('../workouts');
  await setDoc(doc(db, 'users', uid, 'programs', 'p1'), {
    name: 'Prog', effort: 'optimal', muscles: ['chest'], isActive: true, daysPerWeek: 1, createdAt: Date.now(),
    days: [{ index: 0, completedInCycle: false, lifts: [] }],
  });
  await toggleSet(uid, params());
  await completeDay(uid, 'p1', 0);
  const prog = (await getDocs(collection(db, 'users', uid, 'programs'))).docs[0].data();
  const session = (await getDocs(collection(db, 'users', uid, 'sessions'))).docs[0].data();
  expect(prog.days[0].completedInCycle).toBe(true);
  expect(session.finishedAt).not.toBeNull();
});

test('startNextCycle resets completedInCycle; useHistory returns only finished sessions', async () => {
  const { toggleSet, completeDay, startNextCycle } = await import('../workouts');
  await setDoc(doc(db, 'users', uid, 'programs', 'p1'), {
    name: 'Prog', effort: 'optimal', muscles: ['chest'], isActive: true, daysPerWeek: 1, createdAt: Date.now(),
    days: [{ index: 0, completedInCycle: false, lifts: [] }],
  });
  await toggleSet(uid, params());
  await completeDay(uid, 'p1', 0);
  await startNextCycle(uid, 'p1');
  const prog = (await getDocs(collection(db, 'users', uid, 'programs'))).docs[0].data();
  expect(prog.days[0].completedInCycle).toBe(false);
  const finished = (await getDocs(collection(db, 'users', uid, 'sessions'))).docs.filter((d) => d.data().finishedAt !== null);
  expect(finished).toHaveLength(1);
});
```
(Add the imports `query`, `where`, `collection` are already imported in the test file from Task 1; add `doc`, `setDoc`.)

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm --prefix web run test` (merge test fails: `mergedBySetIndex` missing) and `npm --prefix web run test:emulator` (new tests fail).
Expected: FAIL on the new exports.

- [ ] **Step 4: Append to `web/src/data/workouts.ts`**

Add these imports to the existing import block: `getDoc`, `updateDoc` from `firebase/firestore`; `programDoc` from `./paths`; and `import type { ProgramDoc } from './types';`

Append:
```ts
// --- prefill (port of HistoryQueries.lastSets + merge) ---

export async function lastSets(
  uid: string,
  exerciseId: string,
  excludingSessionId?: string,
): Promise<LoggedSetWithId[]> {
  const snap = await getDocs(
    query(loggedSetsCol(uid), where('exerciseId', '==', exerciseId), orderBy('loggedAt', 'desc'), limit(50)),
  );
  const docs = snap.docs.map((d) => ({ id: d.id, ...(d.data() as LoggedSetDoc) }));
  const newest = docs.find((d) => d.sessionId !== excludingSessionId);
  if (!newest) return [];
  return docs.filter((d) => d.sessionId === newest.sessionId).sort((a, b) => a.setIndex - b.setIndex);
}

export interface SetValue { weight: number; reps: number }

export function mergedBySetIndex(
  current: { setIndex: number; weight: number; reps: number }[],
  previous: { setIndex: number; weight: number; reps: number }[],
): Map<number, SetValue> {
  const merged = new Map<number, SetValue>();
  for (const s of previous) merged.set(s.setIndex, { weight: s.weight, reps: s.reps });
  for (const s of current) merged.set(s.setIndex, { weight: s.weight, reps: s.reps });
  return merged;
}

// --- cycle / completion ---

export async function completeDay(uid: string, programId: string, dayIndex: number): Promise<void> {
  const pSnap = await getDoc(programDoc(uid, programId));
  if (pSnap.exists()) {
    const prog = pSnap.data() as ProgramDoc;
    const days = prog.days.map((d) => (d.index === dayIndex ? { ...d, completedInCycle: true } : d));
    await updateDoc(programDoc(uid, programId), { days });
  }
  const openSnap = await getDocs(query(sessionsCol(uid), where('finishedAt', '==', null)));
  const batch = writeBatch(db);
  openSnap.docs.forEach((d) => {
    if ((d.data() as SessionDoc).dayIndex === dayIndex) batch.update(d.ref, { finishedAt: Date.now() });
  });
  await batch.commit();
}

export async function startNextCycle(uid: string, programId: string): Promise<void> {
  const pSnap = await getDoc(programDoc(uid, programId));
  if (!pSnap.exists()) return;
  const prog = pSnap.data() as ProgramDoc;
  const days = prog.days.map((d) => ({ ...d, completedInCycle: false }));
  await updateDoc(programDoc(uid, programId), { days });
}

// --- history ---

export function useHistory(uid: string | undefined): { sessions: SessionWithId[]; loading: boolean } {
  const [sessions, setSessions] = useState<SessionWithId[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!uid) { setSessions([]); setLoading(false); return; }
    setLoading(true);
    return onSnapshot(
      query(sessionsCol(uid), orderBy('startedAt', 'desc')),
      (snap) => {
        setSessions(
          snap.docs
            .map((d) => ({ id: d.id, ...(d.data() as SessionDoc) }))
            .filter((s) => s.finishedAt !== null),
        );
        setLoading(false);
      },
      (err) => { console.error('history listener failed', err); setLoading(false); },
    );
  }, [uid]);
  return { sessions, loading };
}
```

- [ ] **Step 5: Run both tiers to verify they pass**

Run: `npm --prefix web run test` → PASS (incl. `mergedBySetIndex`). Run: `npm --prefix web run test:emulator` → PASS (incl. lastSets/completeDay/startNextCycle/history). Run `npm --prefix web run typecheck` → exit 0.

- [ ] **Step 6: Commit**

```bash
git add web/src/data/workouts.ts web/src/data/__tests__/workouts.emulator.test.ts web/src/data/__tests__/mergedBySetIndex.test.ts
git commit -m "feat(web): prefill, cycle completion, and history data layer"
```

---

### Task 3: `useRestTimer` hook

**Files:**
- Create: `web/src/hooks/useRestTimer.ts`
- Test: `web/src/hooks/useRestTimer.test.ts`

**Interfaces:**
- Produces: `useRestTimer(alertSec: number): { elapsed: number; running: boolean; past: boolean; display: string; start(): void; stop(): void }`.

- [ ] **Step 1: Write the failing test `web/src/hooks/useRestTimer.test.ts`**

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix web run test` → FAIL (cannot resolve `./useRestTimer`).

- [ ] **Step 3: Write `web/src/hooks/useRestTimer.ts`**

```ts
import { useEffect, useRef, useState } from 'react';

export function useRestTimer(alertSec: number): {
  elapsed: number;
  running: boolean;
  past: boolean;
  display: string;
  start: () => void;
  stop: () => void;
} {
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const startedAt = useRef<number | null>(null);

  const start = () => { startedAt.current = Date.now(); setElapsed(0); setRunning(true); };
  const stop = () => { setRunning(false); startedAt.current = null; };

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      if (startedAt.current != null) setElapsed(Math.floor((Date.now() - startedAt.current) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [running]);

  const past = running && elapsed >= alertSec;
  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const ss = String(elapsed % 60).padStart(2, '0');
  return { elapsed, running, past, display: `${mm}:${ss}`, start, stop };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix web run test` → PASS. Run `npm --prefix web run typecheck` → exit 0.

- [ ] **Step 5: Commit**

```bash
git add web/src/hooks/useRestTimer.ts web/src/hooks/useRestTimer.test.ts
git commit -m "feat(web): useRestTimer foreground countdown hook"
```

---

### Task 4: Today screen

**Files:**
- Modify: `web/src/screens/TodayScreen.tsx` (replace placeholder)
- Test: `web/src/screens/TodayScreen.test.tsx`

**Interfaces:**
- Consumes: `useAuth`; `useActiveProgram` (`../data/programs`); `startNextCycle` (`../data/workouts`); `dayFocus` (`../data/materialize`); `Link` (react-router); `Eyebrow`.
- Produces: `TodayScreen`.

- [ ] **Step 1: Write `web/src/screens/TodayScreen.tsx`**

```tsx
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { useActiveProgram } from '../data/programs';
import { startNextCycle } from '../data/workouts';
import { dayFocus } from '../data/materialize';
import { Eyebrow } from '../ui/Eyebrow';

export function TodayScreen() {
  const { user } = useAuth();
  const { program, loading } = useActiveProgram(user?.uid);

  if (loading) return <main className="p-6 text-ink-faint">Loading…</main>;

  if (!program) {
    return (
      <main className="flex flex-col gap-4 p-6">
        <Eyebrow className="text-accent">Riptide</Eyebrow>
        <h1 className="text-4xl font-extrabold text-ink">Train.</h1>
        <div className="rounded-card border border-stroke bg-card p-5">
          <p className="text-[15px] font-bold text-ink">Build a program around your life.</p>
          <p className="mt-1 text-[13px] text-ink-dim">Tell Riptide how hard to push, how many days, and what to train.</p>
          <Link to="/wizard" className="mt-4 inline-block rounded-btn bg-accent px-5 py-3 text-[15px] font-extrabold text-on-accent">
            Build my program
          </Link>
        </div>
      </main>
    );
  }

  const days = [...program.days].sort((a, b) => a.index - b.index);
  const nextDay = days.find((d) => !d.completedInCycle) ?? null;

  return (
    <main className="flex flex-col gap-5 p-6">
      <div className="flex items-baseline justify-between">
        <Eyebrow>Today</Eyebrow>
        <Eyebrow className="text-accent">Riptide</Eyebrow>
      </div>
      <h1 className="text-4xl font-extrabold text-ink">Train</h1>

      {nextDay ? (
        <>
          <div className="rounded-[22px] bg-accent p-5 text-on-accent">
            <p className="text-[11px] font-extrabold tracking-[1.2px]">NEXT UP · DAY {nextDay.index + 1} OF {program.daysPerWeek}</p>
            <p className="mt-1 text-[26px] font-extrabold">{dayFocus(nextDay.lifts) || 'Rest'}</p>
            <p className="mt-1 text-[13px] font-semibold opacity-70">
              {nextDay.lifts.length} lifts · {nextDay.lifts.reduce((s, l) => s + l.targetSets, 0)} sets
            </p>
            <Link
              to={`/program/${program.id}/day/${nextDay.index}`}
              className="mt-4 block rounded-[14px] bg-on-accent py-4 text-center text-[15px] font-extrabold text-accent"
            >
              Start day {nextDay.index + 1}
            </Link>
          </div>

          <div className="flex flex-col gap-2">
            <Eyebrow>On deck</Eyebrow>
            {[...nextDay.lifts].sort((a, b) => a.order - b.order).slice(0, 5).map((l) => (
              <div key={l.order} className="flex items-center justify-between rounded-[13px] border border-stroke bg-card px-4 py-3">
                <span className="text-[14px] font-bold text-ink">{l.exerciseName}</span>
                <span className="text-[12px] font-semibold text-ink-faint">{l.targetSets} × {l.repRange}</span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="rounded-card border border-stroke bg-card p-5 text-center">
          <p className="text-[24px] font-extrabold text-accent">Week complete</p>
          <p className="mt-1 text-[13px] text-ink-dim">Every day in this cycle is logged. Start the next one when you’re ready.</p>
          <button
            onClick={() => startNextCycle(user!.uid, program.id).catch((e) => console.error(e))}
            className="mt-4 w-full rounded-btn bg-accent py-4 text-[15px] font-extrabold text-on-accent"
          >
            Start next cycle
          </button>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <Eyebrow>This cycle</Eyebrow>
        <div className="flex gap-2">
          {days.map((d) => {
            const done = d.completedInCycle;
            const isNext = d.index === nextDay?.index;
            return (
              <Link
                key={d.index}
                to={`/program/${program.id}/day/${d.index}`}
                className={`flex-1 rounded-[14px] border py-3 text-center ${
                  done ? 'border-accent bg-accent/10' : isNext ? 'border-accent bg-card' : 'border-stroke bg-card'
                }`}
              >
                <div className="text-[16px] font-extrabold text-ink">{d.index + 1}</div>
                <div className={`text-[9px] font-bold tracking-[1px] ${done || isNext ? 'text-accent' : 'text-ink-faint'}`}>
                  {done ? 'DONE' : isNext ? 'NEXT' : 'TO GO'}
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Write the failing test `web/src/screens/TodayScreen.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { test, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

const useActiveProgram = vi.fn();
const startNextCycle = vi.fn().mockResolvedValue(undefined);
vi.mock('../auth/useAuth', () => ({ useAuth: () => ({ user: { uid: 'u1' } }) }));
vi.mock('../data/programs', () => ({ useActiveProgram: (uid: string) => useActiveProgram(uid) }));
vi.mock('../data/workouts', () => ({ startNextCycle: (...a: unknown[]) => startNextCycle(...a) }));

import { TodayScreen } from './TodayScreen';

const lift = { order: 0, muscle: 'chest', exerciseId: 'bench-press', exerciseName: 'Bench', repRange: '5-8', targetSets: 3 };
const prog = (over: object) => ({ id: 'p1', name: 'X', effort: 'optimal', muscles: ['chest'], isActive: true, daysPerWeek: 2, createdAt: 0, ...over });
const render1 = () => render(<MemoryRouter><TodayScreen /></MemoryRouter>);
beforeEach(() => { startNextCycle.mockClear(); });

test('empty state links to the wizard when no active program', () => {
  useActiveProgram.mockReturnValue({ program: null, loading: false });
  render1();
  expect(screen.getByRole('link', { name: 'Build my program' })).toHaveAttribute('href', '/wizard');
});

test('shows the next uncompleted day and a Start link', () => {
  useActiveProgram.mockReturnValue({
    loading: false,
    program: prog({ days: [
      { index: 0, completedInCycle: true, lifts: [lift] },
      { index: 1, completedInCycle: false, lifts: [lift] },
    ] }),
  });
  render1();
  expect(screen.getByText('NEXT UP · DAY 2 OF 2')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Start day 2' })).toHaveAttribute('href', '/program/p1/day/1');
});

test('week-complete state starts the next cycle', async () => {
  useActiveProgram.mockReturnValue({
    loading: false,
    program: prog({ days: [{ index: 0, completedInCycle: true, lifts: [lift] }] }),
  });
  render1();
  await userEvent.click(screen.getByRole('button', { name: 'Start next cycle' }));
  expect(startNextCycle).toHaveBeenCalledWith('u1', 'p1');
});
```

- [ ] **Step 3: Run tests + typecheck**

Run: `npm --prefix web run test` → PASS. Run `npm --prefix web run typecheck` → exit 0.

- [ ] **Step 4: Commit**

```bash
git add web/src/screens/TodayScreen.tsx web/src/screens/TodayScreen.test.tsx
git commit -m "feat(web): Today screen (next-up, on-deck, cycle dots, week-complete)"
```

---

### Task 5: Day detail — live mode

**Files:**
- Modify: `web/src/screens/DayDetailScreen.tsx`
- Test: `web/src/screens/DayDetailScreen.test.tsx` (append live-mode tests)

**Interfaces:**
- Consumes (added): `useOpenSession`, `useSessionSets`, `completeDay` (`../data/workouts`); `Link` (react-router).
- Produces: `DayDetailScreen` now renders a **live** view when not editing (checkmarks + progress + Complete day + lift links), keeping the existing edit mode.

- [ ] **Step 1: Replace the non-editing render branch in `web/src/screens/DayDetailScreen.tsx`**

Add imports at the top:
```tsx
import { Link } from 'react-router-dom';
import { useOpenSession, useSessionSets, completeDay } from '../data/workouts';
```
Inside the component, after computing `lifts`/`sets` and before the `return`, add:
```tsx
const { session } = useOpenSession(user.uid);
const liveSessionId = session && session.dayIndex === idx ? session.id : undefined;
const { sets: sessionSets } = useSessionSets(user.uid, liveSessionId);
const doneIds = new Set(sessionSets.map((s) => s.exerciseId));
const doneCount = lifts.filter((l) => doneIds.has(l.exerciseId)).length;
const day0 = program.days.find((d) => d.index === idx);
const completed = day0?.completedInCycle ?? false;
```
Wrap the current lift rows so the plain/edit rows show ONLY in edit mode, and add a live list + progress + Complete day for the non-editing branch. Concretely, replace the existing `{lifts.map(...)}` block and the trailing edit-only add-lift block with this structure:
```tsx
{!editing && (
  <>
    <div className="h-1 rounded-full bg-stroke">
      <div className="h-1 rounded-full bg-accent transition-all"
           style={{ width: `${lifts.length ? (doneCount / lifts.length) * 100 : 0}%` }} />
    </div>
    {lifts.map((lift) => {
      const done = doneIds.has(lift.exerciseId);
      return (
        <Link key={lift.order} to={`/program/${id}/day/${idx}/lift/${lift.order}`}
              className="flex items-center gap-3 rounded-card border border-stroke bg-card p-4">
          <span className={done ? 'text-accent' : 'text-ink-faint'}>{done ? '☑' : '○'}</span>
          <div className="flex-1">
            <p className="text-[15px] font-bold text-ink">{lift.exerciseName}</p>
            <p className="text-[12px] text-ink-faint">{lift.targetSets} sets · {lift.repRange} reps</p>
          </div>
          <span className="text-ink-faint">›</span>
        </Link>
      );
    })}
    <button
      onClick={() => completeDay(user.uid, id, idx).catch((e) => console.error(e))}
      disabled={completed}
      className="mt-2 w-full rounded-btn bg-accent py-4 text-[15px] font-extrabold text-on-accent disabled:opacity-50"
    >
      {completed ? 'Day logged' : 'Complete day'}
    </button>
  </>
)}

{editing && (
  <>
    {/* existing edit-mode lift rows (the current {lifts.map(...)} card block) */}
    {/* existing add-lift block */}
  </>
)}
```
Move the existing edit-mode lift-row `.map` (the card with up/down/delete/sets/swap) and the add-lift block inside the `{editing && (...)}` wrapper unchanged. Keep the header (Eyebrow/title/Edit toggle) and `saveLifts`/`move`/`setSets`/`remove`/`swap`/`add` exactly as they are.

- [ ] **Step 2: Append live-mode tests to `web/src/screens/DayDetailScreen.test.tsx`**

Extend the existing mock of `../data/programs` is unaffected; add a mock for `../data/workouts` and two tests. At the top with the other mocks:
```tsx
const completeDay = vi.fn().mockResolvedValue(undefined);
const useOpenSession = vi.fn();
const useSessionSets = vi.fn();
vi.mock('../data/workouts', () => ({
  useOpenSession: (...a: unknown[]) => useOpenSession(...a),
  useSessionSets: (...a: unknown[]) => useSessionSets(...a),
  completeDay: (...a: unknown[]) => completeDay(...a),
}));
```
Add tests (default: no open session):
```tsx
test('live mode shows a checkmark for a logged lift and links to lift detail', () => {
  useOpenSession.mockReturnValue({ session: { id: 's1', dayIndex: 0 } });
  useSessionSets.mockReturnValue({ sets: [{ exerciseId: 'bench-press', setIndex: 0 }] });
  renderAt();
  expect(screen.getByRole('link', { name: /Barbell Bench Press/ })).toHaveAttribute('href', '/program/p1/day/0/lift/0');
  expect(screen.getByText('☑')).toBeInTheDocument();
});

test('Complete day calls completeDay', async () => {
  useOpenSession.mockReturnValue({ session: null });
  useSessionSets.mockReturnValue({ sets: [] });
  renderAt();
  await userEvent.click(screen.getByRole('button', { name: 'Complete day' }));
  expect(completeDay).toHaveBeenCalledWith('u1', 'p1', 0);
});
```
For the EXISTING edit tests in this file, add `useOpenSession.mockReturnValue({ session: null }); useSessionSets.mockReturnValue({ sets: [] });` in their `beforeEach`/setup so the component renders (the hooks are now always called). Ensure `renderAt()` mocks include these defaults.

- [ ] **Step 3: Run tests + typecheck**

Run: `npm --prefix web run test` → PASS (live + existing edit tests). Run `npm --prefix web run typecheck` → exit 0.

- [ ] **Step 4: Commit**

```bash
git add web/src/screens/DayDetailScreen.tsx web/src/screens/DayDetailScreen.test.tsx
git commit -m "feat(web): day detail live mode (checkmarks, progress, complete day)"
```

---

### Task 6: Lift detail screen

**Files:**
- Create: `web/src/screens/LiftDetailScreen.tsx`
- Modify: `web/src/App.tsx` (add the lift route)
- Test: `web/src/screens/LiftDetailScreen.test.tsx`

**Interfaces:**
- Consumes: `useAuth`; `useProgram` (`../data/programs`); `useProfile` (`../data/profile`); `useOpenSession`, `useSessionSets`, `toggleSet`, `lastSets`, `mergedBySetIndex` (`../data/workouts`); `useRestTimer` (`../hooks/useRestTimer`); `useParams`; `muscleLabel` (`../core`); `Eyebrow`.
- Produces: `LiftDetailScreen` at `/program/:id/day/:dayIndex/lift/:order`.

- [ ] **Step 1: Write `web/src/screens/LiftDetailScreen.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { useProgram } from '../data/programs';
import { useProfile } from '../data/profile';
import { useOpenSession, useSessionSets, toggleSet, lastSets, mergedBySetIndex } from '../data/workouts';
import { useRestTimer } from '../hooks/useRestTimer';
import { muscleLabel } from '../core';
import { Eyebrow } from '../ui/Eyebrow';

const DEFAULT_REST = 180;

export function LiftDetailScreen() {
  const { id, dayIndex, order } = useParams<{ id: string; dayIndex: string; order: string }>();
  const { user } = useAuth();
  const { program, loading } = useProgram(user?.uid, id);
  const { profile } = useProfile(user?.uid);
  const { session } = useOpenSession(user?.uid);
  const timer = useRestTimer(profile?.restAlertSec ?? DEFAULT_REST);

  const idx = Number(dayIndex);
  const ord = Number(order);
  const day = program?.days.find((d) => d.index === idx);
  const lift = day?.lifts.find((l) => l.order === ord);

  const liveSessionId = session && session.dayIndex === idx ? session.id : undefined;
  const { sets: sessionSets, loading: setsLoading } = useSessionSets(user?.uid, liveSessionId);
  const mySets = sessionSets.filter((s) => s.exerciseId === lift?.exerciseId);

  const [weights, setWeights] = useState<string[]>([]);
  const [reps, setReps] = useState<string[]>([]);
  const [prefilled, setPrefilled] = useState(false);

  useEffect(() => {
    if (prefilled || !user || !lift || setsLoading) return;
    (async () => {
      const previous = await lastSets(user.uid, lift.exerciseId, liveSessionId);
      const merged = mergedBySetIndex(mySets, previous);
      setWeights(Array.from({ length: lift.targetSets }, (_, i) => (merged.has(i) ? String(merged.get(i)!.weight) : '')));
      setReps(Array.from({ length: lift.targetSets }, (_, i) => (merged.has(i) ? String(merged.get(i)!.reps) : '')));
      setPrefilled(true);
    })();
  }, [prefilled, user, lift, setsLoading, liveSessionId, mySets]);

  if (loading) return <main className="p-6 text-ink-faint">Loading…</main>;
  if (!program || !user || !id || !lift) return <main className="p-6 text-ink-dim">Lift not found.</main>;

  const doneIndices = new Set(mySets.map((s) => s.setIndex));

  const toggle = (i: number) => {
    const done = doneIndices.has(i);
    toggleSet(user.uid, {
      programId: id, programName: program.name, dayIndex: idx,
      exerciseId: lift.exerciseId, exerciseName: lift.exerciseName,
      setIndex: i, weight: Number(weights[i]) || 0, reps: Number(reps[i]) || 0,
    }).catch((e) => console.error('toggle set failed', e));
    if (!done) timer.start(); else timer.stop();
  };

  const field = (arr: string[], set: (v: string[]) => void, i: number, placeholder: string) => (
    <input
      aria-label={placeholder + '-' + i}
      inputMode="decimal"
      value={arr[i] ?? ''}
      onChange={(e) => { const next = [...arr]; next[i] = e.target.value; set(next); }}
      placeholder={placeholder}
      className="w-full rounded-[11px] border border-stroke bg-input py-2 text-center text-[15px] font-bold text-ink"
    />
  );

  return (
    <main className="flex flex-col gap-4 p-6">
      <div>
        <Eyebrow className="text-accent">{muscleLabel(lift.muscle)}</Eyebrow>
        <h1 className="text-[28px] font-extrabold text-ink">{lift.exerciseName}</h1>
      </div>

      <div className="grid grid-cols-[32px_1fr_1fr_44px] items-center gap-2">
        <Eyebrow>Set</Eyebrow><Eyebrow>Weight</Eyebrow><Eyebrow>Reps</Eyebrow><Eyebrow>Done</Eyebrow>
        {Array.from({ length: lift.targetSets }, (_, i) => {
          const done = doneIndices.has(i);
          return (
            <div key={i} className="contents">
              <span className="text-[15px] font-extrabold text-ink-dim">{i + 1}</span>
              {field(weights, setWeights, i, 'lb')}
              {field(reps, setReps, i, lift.repRange)}
              <button aria-label={`done-${i}`} onClick={() => toggle(i)} className="text-[26px]">
                <span className={done ? 'text-accent' : 'text-ink-faint'}>{done ? '☑' : '○'}</span>
              </button>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between rounded-card border border-stroke bg-card p-4">
        <div>
          <Eyebrow>Rest timer</Eyebrow>
          <p className={`font-mono text-[26px] font-bold ${timer.past ? 'text-accent' : 'text-ink'}`}>
            {timer.running ? timer.display : '—'}
          </p>
        </div>
        {timer.running && (
          <button onClick={() => timer.stop()} className="rounded-xl border border-stroke px-4 py-2 text-[13px] font-bold text-ink">
            Stop
          </button>
        )}
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Add the route in `web/src/App.tsx`**

Import `LiftDetailScreen` and add inside the `AppShell` route group, after the day route:
```tsx
import { LiftDetailScreen } from './screens/LiftDetailScreen';
// ...
<Route path="program/:id/day/:dayIndex/lift/:order" element={<LiftDetailScreen />} />
```

- [ ] **Step 3: Write the failing test `web/src/screens/LiftDetailScreen.test.tsx`**

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { test, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

const toggleSet = vi.fn().mockResolvedValue(undefined);
const lastSets = vi.fn().mockResolvedValue([{ setIndex: 0, weight: 100, reps: 5 }]);
const useOpenSession = vi.fn(() => ({ session: { id: 's1', dayIndex: 0 } }));
const useSessionSets = vi.fn(() => ({ sets: [], loading: false }));
vi.mock('../auth/useAuth', () => ({ useAuth: () => ({ user: { uid: 'u1' } }) }));
vi.mock('../data/profile', () => ({ useProfile: () => ({ profile: { restAlertSec: 180 } }) }));
vi.mock('../data/programs', () => ({
  useProgram: () => ({
    loading: false,
    program: { id: 'p1', name: 'X', days: [{ index: 0, lifts: [
      { order: 0, muscle: 'chest', exerciseId: 'bench-press', exerciseName: 'Bench', repRange: '5-8', targetSets: 2 },
    ] }] },
  }),
}));
vi.mock('../data/workouts', () => ({
  useOpenSession: () => useOpenSession(),
  useSessionSets: () => useSessionSets(),
  toggleSet: (...a: unknown[]) => toggleSet(...a),
  lastSets: (...a: unknown[]) => lastSets(...a),
  mergedBySetIndex: (cur: { setIndex: number; weight: number; reps: number }[], prev: { setIndex: number; weight: number; reps: number }[]) => {
    const m = new Map(); for (const s of prev) m.set(s.setIndex, { weight: s.weight, reps: s.reps }); for (const s of cur) m.set(s.setIndex, { weight: s.weight, reps: s.reps }); return m;
  },
}));

import { LiftDetailScreen } from './LiftDetailScreen';

function renderAt() {
  return render(
    <MemoryRouter initialEntries={['/program/p1/day/0/lift/0']}>
      <Routes><Route path="/program/:id/day/:dayIndex/lift/:order" element={<LiftDetailScreen />} /></Routes>
    </MemoryRouter>,
  );
}
beforeEach(() => toggleSet.mockClear());

test('prefills weight/reps from last time', async () => {
  renderAt();
  await waitFor(() => expect((screen.getByLabelText('lb-0') as HTMLInputElement).value).toBe('100'));
  expect((screen.getByLabelText('5-8-0') as HTMLInputElement).value).toBe('5');
});

test('toggling DONE logs the set with entered values', async () => {
  renderAt();
  await waitFor(() => expect((screen.getByLabelText('lb-0') as HTMLInputElement).value).toBe('100'));
  await userEvent.click(screen.getByLabelText('done-0'));
  expect(toggleSet).toHaveBeenCalledWith('u1', expect.objectContaining({
    programId: 'p1', dayIndex: 0, exerciseId: 'bench-press', setIndex: 0, weight: 100, reps: 5,
  }));
});
```

- [ ] **Step 4: Run tests + typecheck**

Run: `npm --prefix web run test` → PASS. Run `npm --prefix web run typecheck` → exit 0. Run `npm --prefix web run build` → succeeds.

- [ ] **Step 5: Commit**

```bash
git add web/src/screens/LiftDetailScreen.tsx web/src/screens/LiftDetailScreen.test.tsx web/src/App.tsx
git commit -m "feat(web): lift detail — set logging, prefill, foreground rest timer"
```

---

### Task 7: History screen + More link

**Files:**
- Create: `web/src/screens/HistoryScreen.tsx`
- Modify: `web/src/screens/MoreScreen.tsx` (add History link), `web/src/App.tsx` (history route)
- Test: `web/src/screens/HistoryScreen.test.tsx`

**Interfaces:**
- Consumes: `useAuth`; `useHistory` (`../data/workouts`); `Eyebrow`; `Link` (react-router).
- Produces: `HistoryScreen` at `/history`; a "History" link in More.

- [ ] **Step 1: Write `web/src/screens/HistoryScreen.tsx`**

```tsx
import { useAuth } from '../auth/useAuth';
import { useHistory } from '../data/workouts';
import { Eyebrow } from '../ui/Eyebrow';

export function HistoryScreen() {
  const { user } = useAuth();
  const { sessions, loading } = useHistory(user?.uid);

  return (
    <main className="flex flex-col gap-3 p-6">
      <Eyebrow>History</Eyebrow>
      <h1 className="text-3xl font-extrabold text-ink">Sessions</h1>
      {loading ? (
        <p className="text-ink-faint">Loading…</p>
      ) : sessions.length === 0 ? (
        <p className="text-[13px] text-ink-dim">Nothing logged yet — finish a workout and it lands here.</p>
      ) : (
        sessions.map((s) => (
          <div key={s.id} className="rounded-card border border-stroke bg-card p-4">
            <div className="flex items-center justify-between">
              <span className="text-[15px] font-bold text-ink">
                {new Date(s.startedAt).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
              </span>
              <span className="text-[12px] font-semibold text-ink-faint">{s.setCount} sets</span>
            </div>
            <p className="text-[12px] text-ink-dim">
              {(s.programName || 'Deleted program')} · Day {s.dayIndex + 1}
            </p>
          </div>
        ))
      )}
    </main>
  );
}
```

- [ ] **Step 2: Add the route + a More link**

In `web/src/App.tsx`, import `HistoryScreen` and add inside `AppShell`:
```tsx
<Route path="history" element={<HistoryScreen />} />
```
In `web/src/screens/MoreScreen.tsx`, add a `Link` to `/history` above the rest-timer card (import `Link` from `react-router-dom`):
```tsx
<Link to="/history" className="rounded-card border border-stroke bg-card p-4 text-[15px] font-bold text-ink">
  History →
</Link>
```

- [ ] **Step 3: Write the failing test `web/src/screens/HistoryScreen.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react';
import { test, expect, vi } from 'vitest';

const useHistory = vi.fn();
vi.mock('../auth/useAuth', () => ({ useAuth: () => ({ user: { uid: 'u1' } }) }));
vi.mock('../data/workouts', () => ({ useHistory: () => useHistory() }));

import { HistoryScreen } from './HistoryScreen';

test('empty state', () => {
  useHistory.mockReturnValue({ sessions: [], loading: false });
  render(<HistoryScreen />);
  expect(screen.getByText(/Nothing logged yet/)).toBeInTheDocument();
});

test('renders a session row with set count and program label', () => {
  useHistory.mockReturnValue({
    loading: false,
    sessions: [{ id: 's1', startedAt: Date.now(), setCount: 12, programName: '4-Day Optimal', dayIndex: 2, finishedAt: Date.now() }],
  });
  render(<HistoryScreen />);
  expect(screen.getByText('12 sets')).toBeInTheDocument();
  expect(screen.getByText(/4-Day Optimal · Day 3/)).toBeInTheDocument();
});
```

- [ ] **Step 4: Run tests + typecheck + build**

Run: `npm --prefix web run test` → PASS. Run `npm --prefix web run typecheck` → exit 0. Run `npm --prefix web run build` → succeeds.

- [ ] **Step 5: Commit**

```bash
git add web/src/screens/HistoryScreen.tsx web/src/screens/HistoryScreen.test.tsx web/src/screens/MoreScreen.tsx web/src/App.tsx
git commit -m "feat(web): history screen and More link"
```

---

### Task 8: Full-suite verification & build

**Files:** none (verification + any glue fix).

- [ ] **Step 1: Default tier**

Run: `npm --prefix web run test` → all suites green (engine + Plans 2/3a + 3b).

- [ ] **Step 2: Emulator tier**

Run: `npm --prefix web run test:emulator` → rules + profile + programs + workouts all pass.

- [ ] **Step 3: Typecheck + build**

Run: `npm --prefix web run typecheck` → exit 0. Run `npm --prefix web run build` → succeeds (manifest + sw emitted).

- [ ] **Step 4: Confirm no placeholders remain**

Run: `grep -rn "coming in Plan 3\|(Task " web/src/screens/*.tsx || echo "no placeholders"`
Expected: `no placeholders` (Today is now real; all screens implemented).

- [ ] **Step 5: Commit (only if a glue fix was needed)**

```bash
git add -A && git commit -m "chore(web): plan 3b verification glue" || echo "nothing to commit"
```

---

## Self-Review

**1. Spec coverage (against `2026-08-06-riptide-pwa-3b-training.md`):**
- §3 `SessionDoc.setCount` + path helpers → Task 1.
- §4.1/§4.2 sessions + loggedSets hooks (`useOpenSession`, `useSessionSets`, `useHistory`) → Tasks 1, 2.
- §4.3 `toggleSet` (lazy session, at-most-one-open, add/delete, setCount) → Task 1.
- §4.4 `lastSets` + `mergedBySetIndex` → Task 2.
- §4.5 `completeDay`, `startNextCycle` → Task 2.
- §5.1 Today → Task 4. §5.2 Day live mode → Task 5. §5.3 Lift detail + rest timer → Tasks 3, 6. §5.4 History + More link → Task 7.
- §6 `useRestTimer` → Task 3. §7 routing (lift, history) → Tasks 6, 7.
- §9 testing: emulator (T1/T2), unit (merge T2, timer T3), component (every screen T4–T7), verification (T8).

**2. Placeholder scan:** No TBD/vague steps; every code step has complete content; commands have expected output. Task 8 Step 4 asserts no screen placeholders remain (Today replaced in T4).

**3. Type consistency:** `SessionDoc`/`LoggedSetDoc` (+`setCount`) consistent across types.ts, workouts.ts, tests. `ToggleSetParams` identical in `toggleSet` (T1), Lift detail (T6), and tests. `SessionWithId`/`LoggedSetWithId` return shapes consistent. Hook signatures (`useOpenSession`, `useSessionSets(uid, id?)`, `useHistory`) match between workouts.ts and every consumer (T5, T6, T7). `mergedBySetIndex(current, previous)` argument order consistent (T2 def, T6 use, tests). Route params (`id`, `dayIndex`, `order`) match `App.tsx` (T6) and `useParams` (T6). `completeDay(uid, programId, dayIndex)` / `startNextCycle(uid, programId)` signatures consistent (T2 def, T4/T5 use). Query shapes need only single-field indexes + the pre-declared `loggedSets` composite (no new index files).

**Out of scope:** background/push notifications, keep-awake — per spec. After 3b the PWA matches the Swift app.
```
