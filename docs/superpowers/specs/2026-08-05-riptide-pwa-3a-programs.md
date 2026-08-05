# Riptide PWA — Plan 3a: Programs & Planning Design Spec

**Date:** 2026-08-05
**Status:** Approved (design), pending implementation plan
**Builds on:** the overall PWA design (`2026-08-02-riptide-pwa-design.md`), the merged engine (Plan 1), and the app foundation (Plan 2, `2026-08-04-riptide-pwa-app-foundation.md`).

## 1. Purpose

Build the **program-planning half** of Riptide on the Plan 2 foundation: the `programs` data layer plus the screens for creating and managing programs — the **Wizard**, **Program library**, **Program detail**, and **Day detail** (view + edit). It is a faithful port of the Swift app's planning screens, developed emulator-first.

**Plan 3 is split into 3a (this spec) and 3b.** 3a delivers "build and manage a program." 3b adds training/logging (Today, sessions, loggedSets, Day live mode, Lift detail, History).

**Definition of done:** a signed-in user can run the Wizard to generate and name a program (which becomes active), see it in the Program library, open it, make-active / rename / delete it, and edit any day's lifts (reorder / swap / add / delete / set count) — all persisted to Firestore and working against the emulator.

## 2. Constraints (inherited)

- **Emulator-first**; two test tiers (default jsdom/hermetic excludes `*.emulator.test.*`; `test:emulator` runs against the Firestore+Auth emulators). Node 20+, npm via `npm --prefix web …`, TS strict, ESM.
- **Engine (`web/src/core`) is consumed, never modified**; imported via its barrel.
- **Reactive data pattern** established in Plan 2 (`data/profile.ts`): repository write functions + `onSnapshot` read hooks (the hook now includes the error callback added in the Plan 2 review). All reads go through the cache (offline-first).
- **Owner-only security rules** already enforce `/users/{uid}/…`; no rule changes needed (programs live under `users/{uid}/programs`).
- Ice-palette Tailwind tokens + `ui/` primitives (`Card`, `AccentButton`, `Eyebrow`) from Plan 2; extend as needed.

## 3. Data model changes

### 3.1 `ProgramDoc` / `ProgramDayDoc` (in `web/src/data/types.ts`)

Extend `ProgramDoc` to match the Swift `Program` model, and **remove the stored `focus`** from `ProgramDayDoc` (it becomes computed):

```ts
export interface ProgramDoc {
  name: string;
  effort: Effort;               // NEW (from ../core)
  muscles: MuscleGroup[];       // NEW — selected groups, in DISPLAY_ORDER
  isActive: boolean;
  daysPerWeek: number;
  createdAt: number;
  days: ProgramDayDoc[];
}
export interface ProgramDayDoc {
  index: number;
  completedInCycle: boolean;    // set false at creation; used by 3b cycle logic
  lifts: PlannedLiftDoc[];
  // focus is NOT stored — computed via dayFocus(lifts)
}
// PlannedLiftDoc, SessionDoc, LoggedSetDoc unchanged from Plan 2.
```

`Effort` and `MuscleGroup` import from `../core`. Nothing in Plan 2 reads `ProgramDayDoc.focus` (only the profile path is live), so removing it is safe.

### 3.2 Computed focus

```ts
// data/programs.ts (or a small helper module)
export function dayFocus(lifts: PlannedLiftDoc[]): string
```
Mirrors the Swift computed property: the day's lift muscles, de-duplicated in lift order, joined by `" · "` (e.g. `"Chest · Lats · Triceps"`). Computed at render time so it always reflects the current (possibly edited) lifts.

## 4. Materialization (engine → Firestore)

`web/src/data/materialize.ts` — a pure function mirroring `ProgramMaterializer.materialize`:

```ts
export interface NewProgramInput {
  name: string;
  effort: Effort;
  days: number;
  selections: Map<MuscleGroup, ExerciseDefinition[]>;
}
export function materialize(generated: GeneratedProgram, input: NewProgramInput): Omit<ProgramDoc, never>
```
- `muscles` = `DISPLAY_ORDER.filter(m => (selections.get(m) ?? []).length > 0)`.
- `days` = `generated.days.map((day, i) => ({ index: i, completedInCycle: false, lifts: day.lifts.map((lift, j) => ({ order: j, exerciseId: lift.exercise.id, exerciseName: lift.exercise.name, muscle: lift.exercise.primary, repRange: lift.exercise.repRange, targetSets: lift.sets })) }))`.
- `createdAt` = `Date.now()`, `isActive` = `true` (caller's batch enforces single-active), `daysPerWeek` = `input.days`.

Pure and deterministic → unit-testable without Firestore.

## 5. Programs repository & hooks (`web/src/data/programs.ts`)

Writes (repository functions):
- `createProgram(uid: string, input: NewProgramInput): Promise<string>` — runs `generate(toGeneratorInput(input))`, `materialize(...)`, then a **batched write**: set `isActive = false` on all existing programs and add the new active program. Returns the new doc id.
- `setActiveProgram(uid: string, id: string): Promise<void>` — batch: `isActive = false` on all others, `true` on `id`.
- `renameProgram(uid: string, id: string, name: string): Promise<void>`.
- `deleteProgram(uid: string, id: string): Promise<void>` — deletes the program doc only (sessions/loggedSets are separate and survive).
- `updateProgramDays(uid: string, id: string, days: ProgramDayDoc[]): Promise<void>` — rewrites the nested `days` array in one atomic doc update (used by all Day-detail edits).

Reads (reactive hooks over `onSnapshot`, each with an error callback that clears loading):
- `usePrograms(uid): { programs: (ProgramDoc & { id: string })[]; loading }` — ordered by `createdAt` **descending (newest first)**.
- `useProgram(uid, id): { program: (ProgramDoc & { id: string }) | null; loading }`.
- `useActiveProgram(uid): { program: (ProgramDoc & { id: string }) | null; loading }` — query `where('isActive','==',true)`, take first.

`toGeneratorInput(input)` builds the `GeneratorInput` the engine expects. Program docs are read with their Firestore id attached (`{ id, ...data }`) since callers need the id for navigation and writes.

## 6. Screens

All screens use the ice-palette tokens/primitives and live under `web/src/screens/`.

### 6.1 Wizard (`WizardScreen.tsx`) — faithful port of `WizardView`
- Steps, in order: **effort → days → muscles → exercises (one step per chosen muscle) → name**.
  - **effort:** three cards (`minimal`/`optimal`/`maximal`) with the sample chest range (`weeklyRange('chest', e)`) and the effort blurbs from the Swift source. Selecting an effort resets `days` if the current value isn't in `allowedDays(effort)`.
  - **days:** buttons for `allowedDays(effort)`.
  - **muscles:** chips in `DISPLAY_ORDER`, multi-select, flex-wrap layout; kept in `DISPLAY_ORDER`.
  - **exercises(i):** for `muscles[i]`, a checkbox list of `ExerciseBank.exercisesFor(muscle)`; ≥1 required to advance.
  - **name (NEW):** a text field pre-filled with the default `"{days}-Day {Effort label}"` (e.g. `"4-Day Optimal"`), editable, non-empty required. Button label "Build my program".
- Progress bar + "STEP x OF y" (`y = 4 + muscles.length` now, because of the added name step), back navigation (back from the first step exits the wizard).
- On finish: `createProgram(uid, { name, effort, days, selections })` → navigate to `/program/:id` for the new program.

### 6.2 Program library (`ProgramLibraryScreen.tsx`) — Program tab root
- `usePrograms(uid)`; list rows showing name, `dayFocus` summary / `{daysPerWeek} days`, and an **ACTIVE** badge on the active one. Row → `/program/:id`.
- **Empty state**: prompt + **"Build a program"** → Wizard. A **"New program"** affordance is also present when the list is non-empty.

### 6.3 Program detail (`ProgramDetailScreen.tsx`)
- `useProgram(uid, id)`; header with name; **Make active** (calls `setActiveProgram`, disabled/hidden if already active), **Rename** (inline text field → `renameProgram`), **Delete** (confirmation → `deleteProgram` → navigate back to library).
- Day list: each day shows `Day {index+1}` + `dayFocus` + lift/set counts; tap → `/program/:id/day/:index`.

### 6.4 Day detail (`DayDetailScreen.tsx`) — view + edit (planning only)
- `useProgram(uid, id)`, select `days[index]`. Header: `Day {index+1}`, `dayFocus`, counts.
- **View mode:** read-only lift rows (name, `{targetSets} sets · {repRange} reps`).
- **Edit mode** (toggle): each lift row supports **reorder** (up/down, re-index `order`), **swap** (menu of `ExerciseBank.exercisesFor(muscle)` alternatives), **set-count** stepper (min 1, max 10), **delete**; plus **"+ Add a lift"** (choose muscle → choose exercise → append with next `order`). Every edit builds the updated `days` array and calls `updateProgramDays`.
- **No live/logging UI in 3a** (progress bar, per-set checkmarks, "Complete day" belong to 3b).

## 7. Navigation / routing

Extend the Plan 2 router (React Router). The authed `AppShell` tab layout gains real Program-tab routes:
- `/program` → `ProgramLibraryScreen`
- `/program/:id` → `ProgramDetailScreen`
- `/program/:id/day/:dayIndex` → `DayDetailScreen`
- `/wizard` → `WizardScreen` (full-screen within the authed area; reached from the library).
- `/` (Today) and `/more` unchanged (Today still the Plan 2 placeholder; real Today is 3b).

Route params (`id`, `dayIndex`) drive the hooks. Missing/invalid ids render a graceful "not found" fallback.

## 8. Behavior details

- **Single active program:** creating a program auto-activates it and deactivates the rest (batched); `setActiveProgram` maintains the invariant. Enforced in the repository, not the UI.
- **Editing model:** days/lifts are nested in the program doc; all edits rewrite the `days` array and write the whole doc (cheap, atomic — consistent with the data-model decision). Lifts are identified by array position/`order`; reorder re-indexes `order` from position.
- **Delete preserves history:** deleting a program removes only its doc; `sessions`/`loggedSets` (3b) reference `programId` + a denormalized `programName`, so they persist. No cascade exists in Firestore.
- **Offline:** all reads serve from cache; edits queue offline and sync — inherited from Plan 2's `persistentLocalCache`.

## 9. Testing

- **Emulator integration (`*.emulator.test.ts`):** the `programs` repository against the Firestore+Auth emulators — `createProgram` produces exactly one active program (and deactivates a prior one), `usePrograms`/`useActiveProgram` reflect writes, `setActiveProgram` moves the active flag, `renameProgram`, `deleteProgram` removes the doc. (Follows the Plan 2 `profile.emulator.test.ts` pattern: anonymous sign-in for a real uid.)
- **Unit:** `materialize` (generated → doc mapping: indices, order, field mapping, muscles in DISPLAY_ORDER, single-day counts) and `dayFocus` (dedup + order + separator).
- **Component (default tier, mocked hooks/repository):** Wizard (step gating, name default, "Build my program" calls `createProgram` with the assembled input), library (rows + active badge + empty state), detail (make-active / rename / delete actions), Day-detail edit ops (reorder / swap / add / delete / set-count produce the expected `updateProgramDays` payload).
- **Engine + Plan 2 tests** continue to pass unchanged.

## 10. Out of scope (→ Plan 3b)

Today screen and cycle logic (`completedInCycle`, start-day, week-complete / start-next-cycle), `sessions` + `loggedSets` repositories, Day-detail **live** mode (progress + per-lift checkmarks + Complete day), **Lift detail** (set logging, cross-program prefill, foreground rest timer), **History**. Real app icons/media and any non-Google auth remain out per the overall spec.
