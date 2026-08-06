# Riptide PWA — Plan 3b: Training & Logging Design Spec

**Date:** 2026-08-06
**Status:** Approved (design), pending implementation plan
**Builds on:** overall PWA design (`2026-08-02`), engine (Plan 1), app foundation (Plan 2), programs & planning (Plan 3a).

## 1. Purpose

Complete the app: turn "build a program" into "train it." A faithful port of the Swift training loop onto the Plan 3a foundation — the `sessions` + `loggedSets` data layer, the Today screen, live workout logging (Day live mode + Lift detail with cross-program prefill + a foreground rest timer), cycle/complete-day tracking, and History. One plan, emulator-first.

**After 3b, the PWA is feature-complete versus the Swift original.**

## 2. Constraints (inherited)

- Emulator-first; two test tiers (default jsdom/hermetic excludes `*.emulator.test.*`; `test:emulator` against Firestore+Auth emulators, project `demo-riptide`). Node 20+, npm via `npm --prefix web …`, TS strict, ESM.
- Engine (`web/src/core`) consumed, never modified. Reactive data pattern from `data/profile.ts`/`data/programs.ts` (repository writes + `onSnapshot` hooks with error callbacks; docs read as `{ id, ...data }`).
- Owner-only rules already cover `users/{uid}/…` (sessions + loggedSets included); no rule change. The `loggedSets` composite index (`exerciseId ASC` + `loggedAt DESC`) is already declared in `firestore.indexes.json`.
- Ice-palette Tailwind tokens + `ui/` primitives.
- **Faithful port** of the Swift `TodayView`, `DayDetailView` (live mode), `LiftDetailView`, `HistoryView`, `HistoryQueries`, and `SetLogger`, minus the removed features below.

## 3. Data model

Reuse the Plan 2 `SessionDoc` / `LoggedSetDoc`, with one addition:

```ts
export interface SessionDoc {
  programId: string;
  programName: string;   // denormalized so history survives program deletion
  dayIndex: number;
  startedAt: number;
  finishedAt: number | null;
  setCount: number;      // NEW — denormalized count for History; kept via increment(±1)
}
// LoggedSetDoc unchanged: { sessionId, exerciseId, exerciseName, setIndex, weight, reps, dayIndex, loggedAt }
```

Path helpers already exist (`sessionsCol`, `loggedSetsCol`); add `sessionDoc(uid,id)` and `loggedSetDoc(uid,id)`.

## 4. Data layer (`web/src/data/workouts.ts`)

Repository writes + `onSnapshot` hooks, mirroring the Swift `HistoryQueries` + `SetLogger`.

### 4.1 Sessions
- **`useOpenSession(uid): { session: SessionWithId | null; loading }`** — query `sessions where finishedAt == null orderBy startedAt desc`, take first. (At most one open is maintained by the write path; the query is defensive.)
- **`useHistory(uid): { sessions: SessionWithId[]; loading }`** — `sessions where finishedAt != null orderBy startedAt desc`.

### 4.2 Logged sets
- **`useSessionSets(uid, sessionId | undefined): { sets: LoggedSetWithId[]; loading }`** — `loggedSets where sessionId == id` (reactive; drives live checkmarks and the set grid). Returns `[]` when `sessionId` is undefined.

### 4.3 Toggle a set (port of `SetLogger.toggle`)
`toggleSet(uid, params): Promise<void>` where params carry the day/program context and the set:
```ts
interface ToggleSetParams {
  programId: string; programName: string; dayIndex: number;
  exerciseId: string; exerciseName: string;
  setIndex: number; weight: number; reps: number;
}
```
Behavior:
1. **Resolve the open session for this day.** Read the open session (`finishedAt == null`). If it exists *and* its `dayIndex === params.dayIndex`, use it. Otherwise, **close any open sessions** (`finishedAt = now`) — enforcing at-most-one-open — and create a new `SessionDoc` (`startedAt = now`, `finishedAt = null`, `setCount = 0`, the given program/day fields).
2. **Add or delete the set.** If a `loggedSet` already exists in that session for `(exerciseId, setIndex)`, delete it and `setCount += -1`; else add a `loggedSet` (`loggedAt = now`) and `setCount += 1`. The set write and the `setCount` `increment(...)` go in one batch.

### 4.4 Prefill (port of `HistoryQueries.lastSets` + merge)
- **`lastSets(uid, exerciseId, excludingSessionId?): Promise<LoggedSetWithId[]>`** — query `loggedSets where exerciseId == X orderBy loggedAt desc` (fetch a bounded window, e.g. 50). Take the newest set (optionally the newest whose `sessionId !== excludingSessionId`), then return all fetched sets from *that* session, sorted by `setIndex`.
- **`mergedBySetIndex(current, previous): Map<number, LoggedSetLike>`** — previous keyed by `setIndex`, then current overlaid (current wins per index). Same semantics as the Swift helper: a lift re-entered mid-workout shows what was already logged this session, falling back to last time's numbers for indices not yet logged.

### 4.5 Cycle / completion
- **`completeDay(uid, programId, dayIndex): Promise<void>`** — set `days[dayIndex].completedInCycle = true` (rewrite the program's `days` array, as in 3a) and, if the open session's `dayIndex === dayIndex`, set its `finishedAt = now`.
- **`startNextCycle(uid, programId): Promise<void>`** — set every day's `completedInCycle = false`.

## 5. Screens

### 5.1 Today (`TodayScreen.tsx`, replaces the placeholder) — port of `TodayView`
- `useActiveProgram(uid)`; `nextDay` = first day where `!completedInCycle` (by index).
- **Has active program + a next day:** next-up card ("NEXT UP · DAY n OF m", `dayFocus`, lift/set counts, "Start day n" → `/program/:activeId/day/:index`); **on-deck** list (first ~5 lifts); **cycle dots** (one per day: number + DONE / NEXT / TO GO, tappable → that day).
- **Active program, all days complete:** week-complete card + "Start next cycle" → `startNextCycle`.
- **No active program:** empty state → "Build my program" (`/wizard`).

### 5.2 Day detail — add live mode (extend `DayDetailScreen.tsx`) — port of `DayDetailView`
- Default **live** view: for each lift a DONE checkmark (from the open session's logged sets for this day), a **progress bar** (completed lifts / total), and a **Complete day** button (`completeDay`, disabled once `completedInCycle`). Tapping a lift → Lift detail.
- "Done"/"Complete" per-lift status derives from `useOpenSession` + `useSessionSets` (a lift counts as done if it has ≥1 logged set this session). Only the open session whose `dayIndex` matches this day contributes.
- The **Edit** toggle keeps the 3a edit UI (reorder/swap/set-count/add/delete) unchanged.

### 5.3 Lift detail (`LiftDetailScreen.tsx`, new) — port of `LiftDetailView`
- Route `/program/:id/day/:dayIndex/lift/:order`; resolves the lift from the program's day by `order`.
- A row per target set: SET # · WEIGHT (number) · REPS (number) · DONE (toggle). Toggling DONE calls `toggleSet(...)` (logs/unlogs). Inputs are numeric.
- **Prefill:** on load, fill weight/reps from `mergedBySetIndex(currentSessionSets, lastSets(excluding current session))` — this session's logged values where present, else last time's (any program). Prefill is keyed by `setIndex`.
- **Foreground rest timer:** a `useRestTimer` hook — starts counting when a set is logged; shows `mm:ss`; flips to the accent color once elapsed ≥ `restAlertSec` (from the profile, default 180). No OS notification. Timer stops/resets when leaving the screen.
- "Complete lift" (or back) returns to Day detail.

### 5.4 History (`HistoryScreen.tsx`, new) — port of `HistoryView`
- `useHistory(uid)`; each row: date (weekday, month, day), `setCount` sets, and "`{live program name || denormalized programName || 'Deleted program'}` · Day n". Empty state message.
- Reachable from More (add a "History" link) — matching the Swift app where History lived under More.

## 6. Rest timer (`web/src/hooks/useRestTimer.ts`)

`useRestTimer(alertSec): { elapsed: number; running: boolean; start(): void; stop(): void; display: string; past: boolean }`. A `setInterval`-based elapsed counter; `past = running && elapsed >= alertSec`; `display` formats `mm:ss`. Pure UI/foreground; cleaned up on unmount. No notifications, no wake lock.

## 7. Routing

Add under the authed `AppShell`:
- `program/:id/day/:dayIndex/lift/:order` → `LiftDetailScreen`.
- `history` → `HistoryScreen` (linked from More; or a `/history` route). 
Today's "Start day" and cycle dots navigate to existing `program/:id/day/:dayIndex` (now with live mode). Existing routes unchanged.

## 8. Behavior details

- **At-most-one-open-session:** enforced in `toggleSet` (close stragglers before creating a new session), matching `SetLogger`.
- **History is exercise-scoped:** prefill looks up an exercise across *all* programs/sessions (not just the current program), matching the Swift design.
- **Delete-preserves-history:** unchanged — sessions/loggedSets are independent of program docs; History falls back to the denormalized `programName`.
- **Offline:** logging works offline (queued writes, cache reads) via Plan 2's persistence; checkmarks/prefill update from cache immediately.
- **Edits vs. logging:** editing a day's plan (3a) and logging against it (3b) are separate modes of Day detail; logging does not mutate the plan, and editing does not touch sessions.

## 9. Testing

- **Emulator integration (`workouts.emulator.test.ts`):** `toggleSet` (creates a session lazily; at-most-one-open — logging a second day closes the first; add then delete restores; `setCount` tracks); `lastSets` + `mergedBySetIndex` (cross-program prefill picks the newest *other* session and merges by setIndex); `completeDay` (sets `completedInCycle` + finishes the session); `startNextCycle`; `useHistory` returns only finished sessions, newest first. (Anonymous sign-in via the `../firebase` singleton, per the Plan 3a pattern.)
- **Unit:** `useRestTimer` (elapsed increments, `past` flips at `alertSec`, `display` format) with fake timers; `mergedBySetIndex` pure merge.
- **Component (default tier, mocked hooks/repo):** Today (next-day card + Start link; cycle dots DONE/NEXT/TO GO; week-complete → startNextCycle; empty → wizard); Day-live (checkmarks reflect logged sets; Complete day calls `completeDay`); Lift detail (toggle calls `toggleSet` with correct args; prefill fills from merged sets; timer flips past target); History (rows with counts + label fallback).
- Engine + Plans 2/3a tests continue to pass.

## 10. Out of scope

Background/push notifications (foreground timer only), keep-awake / screen wake lock (deliberately skipped), real exercise media, non-Google auth — all per the overall spec. Nothing after 3b is required for feature parity with the Swift app.
