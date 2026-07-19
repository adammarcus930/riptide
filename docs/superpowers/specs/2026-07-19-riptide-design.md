# Riptide — Design Spec

**Date:** 2026-07-19
**Status:** Approved pending final user review
**Sources:** Claude Design project "Mobile fitness app design" (`GRIT Fitness App.dc.html`, rebranded Riptide), Notion requirements page "Riptide", Notion workout history ("Adam Workout" and program sub-pages).

## 1. Overview

Riptide is a self-contained iOS app for building and tracking weight-lifting programs. It replaces a Notion-based workout tracking system. The user inputs effort level, available training days, muscle groups, and exercises; the app generates a full-body program that evenly distributes weekly volume across days, then tracks set-by-set logging with per-exercise history.

**P0 scope is weight lifting only.** Diet, cardio, sharing, and progress-analytics are out of scope but the architecture must not preclude them (modular More tab, exercise-scoped history, module-shaped navigation).

### Expected lifecycle (shapes decisions, not code)

Personal use on one iPhone → possibly paid Apple Developer account ($99/yr, removes 7-day re-sign) → possibly TestFlight for friends/family → unlikely App Store release. All stages share one codebase; only signing/distribution changes. Android is the only future requiring a rewrite (UI layer only) and is accepted as the least likely branch.

## 2. Goals / Non-Goals

**Goals**
- Generate full-body programs from: effort, days, muscle groups, chosen exercises.
- Evenly distribute each muscle's weekly volume across training days.
- Account for secondary muscle activation in volume math.
- Log sets (weight lb / reps) with prefill from the last session on that exercise, across programs.
- Multiple saved programs, one active, history always retained.
- Fully offline/self-contained; no backend; device backups cover data.
- CloudKit-compatible data model so iCloud sync can be enabled later without migration.

**Non-Goals (P0)**
- Nutrition, cardio, sharing, progress charts.
- Push/pull/legs or split-style programming (full body only).
- Suggested progression logic (deferred; prefill covers P0).
- Multiple themes (ice only), kg units, iPad/landscape layouts.
- Multi-user sharing via CloudKit.

## 3. Tech Stack & Architecture

- **SwiftUI + SwiftData**, iOS 17+, iPhone portrait.
- **Architecture:** plain SwiftUI ("MV") — views observe `@Model`/`@Observable` state directly; no ViewModel layer. MVVM can be introduced per-screen later if a screen earns it.
- **`RiptideCore`** — local Swift package, pure Swift, no SwiftUI/SwiftData imports:
  - `MuscleGroup`, `Effort` enums; volume tables; effort→day gating.
  - `ExerciseDefinition` + seeded exercise bank (JSON resource).
  - `ProgramGenerator`: pure function `generate(effort, days, selections) → GeneratedProgram`. Deterministic — same inputs, same output.
- App target: screens, SwiftData models, services (rest timer, notifications, haptics).

## 4. Data Model

### RiptideCore value types
- `MuscleGroup` (11): quads, hamstrings, chest, lats, shoulders, traps, triceps, biceps, forearms, calves, abs.
- `Effort`: minimal / optimal / maximal. Exposes per-muscle weekly set ranges and allowed day counts (minimal 2–7, optimal 4–7, maximal 5–7).
- `ExerciseDefinition`: id, name, primary muscle, secondary muscles, rep range, description.

### SwiftData models (all CloudKit-compatible: defaults on properties, optional-to-one/inverse relationships, no `@Attribute(.unique)`)
- `Program` — name, effort, daysPerWeek, selected muscle groups, createdAt, isActive, ordered `[ProgramDay]`.
- `ProgramDay` — index, ordered `[PlannedLift]`, per-cycle completion state.
- `PlannedLift` — exercise id, target sets, rep range. **Materialized copy** of generator output: user edits (set stepper, swap, remove, add) mutate rows directly and are never overwritten; changing wizard inputs means building a new program.
- `WorkoutSession` — startedAt/finishedAt, program + day reference, `[LoggedSet]`. An unfinished session powers the resume banner and survives app kill.
- `LoggedSet` — exercise id, weight (lb), reps, completedAt.

**History is exercise-scoped, not program-scoped.** "Last session" queries read the most recent `LoggedSet`s for an exercise id globally, so a new program containing Bench Press prefills from any prior program's bench history.

### Volume table (weekly sets per muscle, from requirements)

| Muscle (app group) | Minimal | Optimal | Maximal |
|---|---|---|---|
| Chest | 5–8 | 10–14 | 15–20 |
| Lats | 6–9 | 12–16 | 17–22 |
| Traps (upper back: traps/rhomboids) | 4–8 | 10–16 | 17–24 |
| Shoulders (= side delts + rear delts rows summed) | 10–18 | 22–34 | 38–50 |
| Biceps | 4–8 | 10–14 | 16–20 |
| Triceps | 4–8 | 10–14 | 16–20 |
| Quads | 4–8 | 9–14 | 15–20 |
| Hamstrings | 4–6 | 8–12 | 13–18 |
| Calves | 5–8 | 10–16 | 18–24 |
| Abs | 3–6 | 6–12 | 14–18 |
| Forearms | 0–3 | 4–8 | 10–14 |

Mapping decisions (approved): picker stays at the 11 coarse groups. Shoulders targets side+rear delt volume combined; front delts are considered covered by chest/shoulder pressing. Glutes are covered by quad/hamstring compounds; neck is dropped.

## 5. Generation Algorithm (`RiptideCore.ProgramGenerator`)

Inputs: effort, day count (gated by effort), selected muscle groups, ≥1 chosen exercise per selected group.

1. **Weekly targets.** Per muscle: midpoint of the effort range, nudged within the range to divide as cleanly as possible across days.
2. **Secondary credit — fixed order, one pass.** Giver muscles (chest, lats, shoulders, traps, quads, hamstrings, calves) are allocated at full target first. Their exercises' secondary contributions are tallied at **0.5 credit per set**; receiver muscles (triceps, biceps, forearms, abs) then have direct targets reduced by earned credits (floor 0). No iteration, no circular math.
3. **Rotation.** Each muscle's weekly sets split into per-day appearances (~target ÷ days); the user's chosen exercises for that muscle rotate round-robin across appearances. Fewer exercises than appearances → cycle; more → used as evenly as possible within the week.
4. **Set bounds per lift entry:** min 2, target 3, max 4 (reluctantly). When per-day demand exceeds one entry's cap, the muscle appears as **multiple different exercises in the same day**.
5. **Low-volume staggering.** If per-day share would fall below 2 sets, the muscle appears on fewer days at 2–3 sets per appearance. Appearances are staggered so daily set totals stay level.
6. **Resolution ladder when volume and caps conflict (cap wins):**
   1. prefer 3-set entries →
   2. split into a second same-muscle exercise that day →
   3. allow 4-set entries →
   4. aim at the low end of the weekly range →
   5. undershoot and surface it: program view shows e.g. "Shoulders: 8 of 10 target sets — add a day or an exercise to close the gap." Never generate entries above 4 sets.
7. **Output:** value-type week (days → lifts → exercise/sets/rep range) materialized once into SwiftData rows. "Start next cycle" resets completion only — same plan.

The generator never throws: every wizard-valid input yields a program, worst case flagged volume-limited.

## 6. Exercise Bank

Seeded JSON in `RiptideCore`: the design file's built-in library merged with exercises decoded from the user's Notion program pages (e.g., "Pendulum" → Pendulum Squat, "Chest Supported" → Chest-Supported Row, "T-Bar" → T-Bar Row). Each entry: name, primary, secondaries, rep range, short description.

**Secondary rule (approved):** obvious, truly-activated secondaries only — bench/dips → triceps; rows/pull-ups → biceps; overhead press → triceps. No technicality credits (deadlift does not count toward quads). Uncertain Notion decodings are flagged to the user in one batch during implementation.

## 7. Screens & Flows

Design source: `GRIT Fitness App.dc.html`, rebranded **Riptide**, **ice palette only** (colors centralized in one Theme definition).

- **Home ("Train")** — empty state → "Build my program" → wizard. With program: NEXT UP card + Start, ON DECK lifts, stat tiles, THIS CYCLE day dots (tap → day). All days done → Week complete → Start next cycle.
- **Wizard** — steps with progress bar: effort → days (gated) → muscle group chips → per-muscle exercise picker (must pick ≥1 per selected muscle). Finish → generate → materialize → set active.
- **Program** — day list with meta/tags, inline rename, "All programs" → Library.
- **Library** — all programs with progress, Make active (history retained), Build a new program.
- **Day detail** — live mode: lift rows with done checks, progress bar, Complete day. Edit mode: set stepper (+/−), swap (same-muscle bank list), remove, add lift.
- **Lift detail** — media placeholder (P0 static), muscle tags, set grid with weight/reps prefilled from last session (any program), per-set done toggles, rest timer (count-up, alert at threshold, default 90 s, adjustable in Settings), Complete lift.
- **Resume banner** — floating pill during an open session, tap to return; survives app kill.
- **More** — starts clean: Settings (rest-timer threshold) and History. No placeholder module rows.
- **History (P0 addition)** — reverse-chronological session list: date, day focus, sets logged.
- **Bottom nav** — Today / Program / More. Toasts for light confirmations.

**P0 extras (approved):** History screen; local notification when rest threshold passes (works with phone locked); screen stays awake during an active session; haptics on set/lift/day completion.

Units: lb only.

## 8. Persistence & Sync-Readiness

- SwiftData local store; no network anywhere in P0.
- iCloud device backups cover data with zero work.
- Later sync = enable iCloud capability (requires paid dev account) + point SwiftData at a CloudKit container. Model rules in §4 make this a configuration change, not a migration.
- Multi-user sharing is explicitly not covered by this path (future feature work).

## 9. Error Handling

- Generator: total function over valid inputs (see §5); wizard prevents invalid inputs at the source.
- Store init failure: visible error state, not silent failure.
- Set logging: synchronous local writes; no retry/spinner surface needed.
- Notification permission denied: rest timer still works in-app; no nagging.

## 10. Testing

- **Generator unit tests (primary):** invariant sweep across all effort × day-count × muscle-selection shapes — targets within range or explicitly flagged, entries within 2–4 sets, rotation covers all chosen exercises, daily totals level, secondary credits ≤ 0.5 × contributing sets.
- **Snapshot tests:** print generated weeks as readable tables for the approved test-and-tune loop; tuning the feel of outputs happens here, before UI.
- **App-side:** lightweight tests for history prefill query and cycle-completion state transitions.
- **Manual QA:** simulator → personal iPhone via Xcode.

## 11. Repository

- GitHub: public repo `adammarcus930/riptide` (approved), local root `/Users/adam/Projects/fitness`, branch `main`.

## 12. Deferred / Iteration Backlog

- Suggested progression (double-progression nudges) — model already supports.
- Exercise demo GIFs/videos.
- Progress/analytics module; nutrition; cardio; sharing.
- Theme picker (ice-only P0), kg units, iPad.
- iCloud sync toggle (when paid account exists).
