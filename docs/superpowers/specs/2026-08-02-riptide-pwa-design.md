# Riptide PWA — Design Spec

**Date:** 2026-08-02
**Status:** Approved (design), pending implementation plan
**Supersedes for the web target:** builds on `2026-07-19-riptide-design.md` (the original app design). That spec's generation algorithm, muscle model, and volume tables remain authoritative and are ported verbatim.

## 1. Purpose

Rebuild Riptide as an installable, offline-capable Progressive Web App (PWA) with cloud-synced data and Google login, at **feature parity** with the current SwiftUI app.

**Motivation:** the SwiftUI app requires re-sideloading every 7 days (free Apple ID) or a $99/yr developer account. A PWA is free to host, trivially shareable with friends/family via a URL, and — if it ever warrants it — can be wrapped with Capacitor into a native App Store binary later. The web codebase reuses ~all its work in that path, so the PWA is a stepping stone, not a dead end.

**Non-goals for v1:** diet, cardio, payments/premium, real exercise demo media, email/password or magic-link auth, and background (out-of-app) rest-timer notifications.

## 2. Goals & Constraints

- **Free tier only.** Firebase **Spark** plan (no credit card, cannot be billed; service pauses at quota rather than charging). No Cloud Functions in v1 (they require the paid Blaze plan).
- **Offline-first.** The app must work with no signal (gym basements) and sync when a connection returns — the pain point that made Notion unusable for tracking.
- **Never lose data.** Durable cloud storage is a hard requirement; local-only storage (with iOS Safari's ~7-day eviction of script-writable storage) is not acceptable as the source of truth.
- **Coexistence.** The PWA lives beside the Swift app in the same repo. Both may be deployed long-term. `exercises.json` and the engine snapshot fixtures are a **shared contract** so the two implementations never drift.
- **Provable engine parity.** The ported generation engine must produce byte-identical programs to the Swift engine, enforced by tests.

## 3. Architecture

### 3.1 Stack

| Layer | Choice | Rationale |
|---|---|---|
| Front end | **React + Vite** | Largest ecosystem, most examples/training data, cleanest Capacitor path. |
| Styling | **Tailwind CSS** | Ice-palette design tokens encoded as custom theme values; fast, consistent. |
| Backend | **Firebase** (one Google project, Spark tier) | Integrated BaaS: DB + auth + hosting + automatic offline. |
| Database | **Cloud Firestore** | NoSQL fits the shallow data tree; built-in offline persistence; client-direct with security rules. |
| Auth | **Firebase Auth — Google Sign-In (redirect flow)** | One-tap, no password management; redirect is the reliable flow inside an installed PWA. |
| Hosting | **Firebase Hosting** | Static PWA + global CDN + automatic HTTPS, same ecosystem/one deploy. |

### 3.2 Topology

```
Phone
┌───────────────────────────────────────────────┐
│  React PWA (static files, served by Hosting)   │
│     UI  ⇄  Firestore local cache (IndexedDB)   │  ← instant, works offline
└──────────────────────┬────────────────────────┘
                       │  Firestore SDK syncs when online
                       ▼
        Firebase (Firestore + Auth), one Google project, Spark tier
```

There is **no custom backend server** in v1. The browser talks to Firestore directly; Firestore **security rules** are the gatekeeper (each user can access only documents under their own `uid`). Server-side code (a serverless function) would only be introduced later for features requiring a secret key or server-side trust (e.g., payments) — explicitly out of scope for v1.

### 3.3 PWA mechanics

- **Web manifest** — name, icons, theme colors, `display: standalone` so "Add to Home Screen" yields a fullscreen app icon.
- **Service worker** — caches the app shell (via Vite PWA plugin / Workbox) so the app loads instantly and offline. Firestore's own IndexedDB cache handles *data* offline; the service worker handles *code/assets* offline.
- **HTTPS** — required for service workers and PWAs; provided by Firebase Hosting.

## 4. Engine port (`RiptideCore` → TypeScript)

### 4.1 Boundary

The engine is rewritten as an **isolated, dependency-free TypeScript module** (working name `core`) that imports **no React and no Firebase** — mirroring the current pure-Swift `RiptideCore` boundary (no SwiftUI/SwiftData/UIKit). It is independently testable and has one job: given inputs, produce a program.

Ported units (1:1 with the Swift sources):

- `MuscleGroup` — 13-muscle enum (chest, lats, frontDelts, sideDelts, rearDelts, traps, quads, hamstrings, calves, triceps, biceps, forearms, abs), with `givers` (9), `receivers` (4: triceps/biceps/forearms/abs), `processingOrder`, `displayOrder`, and custom labels.
- `Effort`, `VolumeTable` — per-muscle set ranges per effort level (including the split delt rows).
- `Allocation` — `weeklyTarget`, `dayLoads`, `spreadDays` (midpoint target; concentrate at ~3 sets/appearance; even cyclic day-spreading).
- `ProgramGenerator` — secondary-muscle credit (0.5/set), receiver floor (guarantee ~2 direct sets when headroom allows), and the rotation-that-levels-daily-totals distribution.
- `ProgramPrinter` — text rendering used by snapshot tests.
- `ExerciseDefinition` + `ExerciseBank` — loaded from the shared `exercises.json`.

The algorithm semantics are **not** redesigned here; they are ported exactly as specified in `2026-07-19-riptide-design.md` and as implemented in the current Swift sources.

### 4.2 Shared contract

- `exercises.json` — the **single source of truth** for exercise data, consumed by both the Swift and TypeScript engines. The TS build imports the same file (it lives in the repo alongside the Swift resource, or the Swift resource path is referenced directly — resolved during planning). Neither engine maintains its own copy.
- **Snapshot fixtures** — the Swift engine's existing snapshot outputs become **golden files**. The ported TS engine must reproduce them exactly.

### 4.3 Test port (parity guarantee)

The full Swift test suite is ported to TypeScript (Vitest):

- `AllocationTests`, `VolumeTableTests`, `ProgramGeneratorTests`, `ExerciseBankTests` — unit behavior.
- `SnapshotTests` — the TS engine's output is diffed against the **existing Swift snapshot fixtures**. A mismatch fails the build. This converts "did the rewrite introduce a bug?" into a red/green test.

## 5. Data model (Firestore)

All data is namespaced under the signed-in user: `/users/{uid}/…`. Security rules enforce `request.auth.uid == uid` for every read/write.

```
/users/{uid}
  profile                              (single doc)
      { restAlertSec: number, ...settings }

  programs/{programId}
      { name, isActive, daysPerWeek, createdAt,
        days: [                                       // nested array (not a subcollection)
          { index, focus, completedInCycle,
            lifts: [
              { exerciseId, exerciseName, muscle, repRange, targetSets, order }
            ] } ] }

  sessions/{sessionId}
      { programId, programName, dayIndex, startedAt, finishedAt|null }

  loggedSets/{setId}                                  // flat, queryable collection
      { sessionId, exerciseId, exerciseName, setIndex, weight, reps, dayIndex, loggedAt }
```

### 5.1 Design decisions

1. **Program tree nested in one document.** A program (days → lifts) is small and always read/edited as a unit, so it is a single atomic document — one cheap read, one atomic write, no subcollection fan-out. (Firestore's 1 MB doc cap is never approached.)
2. **Logged sets are a flat top-level collection, not nested in sessions.** This is required for the cross-program progression feature: "what did I do last time I performed exercise X, in any program." Firestore cannot efficiently query fields inside a nested array, so sets buried in session docs would make that query painful. As flat documents it is a trivial indexed query. It also caches cleanly for offline.
3. **Exercise definitions are not stored in Firestore.** They are static app data shipped in the bundle (the shared `exercises.json`).
4. **Denormalized `programName` on sessions** (as in the Swift app) so history survives program deletion — deleting a program does not delete its logged sessions/sets.

### 5.2 Key queries

- Active program: `programs where isActive == true` (expect 0 or 1).
- Open session for today: `sessions where finishedAt == null` (at most one enforced by the write path).
- Sets logged in the current session for a lift: `loggedSets where sessionId == current`.
- **Prefill / progression:** `loggedSets where exerciseId == X orderBy loggedAt desc` → take the sets from the most recent session in which the exercise appeared.
- History: `sessions orderBy startedAt desc`, each session's sets via `loggedSets where sessionId == id`.

Composite indexes for the above are declared in `firestore.indexes.json`.

### 5.3 Security rules

```
match /users/{uid}/{document=**} {
  allow read, write: if request.auth != null && request.auth.uid == uid;
}
```

Rules are validated with the Firestore emulator in tests (see §8). Fields set only by trusted logic in a future paid tier (none in v1) would be locked down further; v1 has no such fields.

## 6. Offline & sync

- **Firestore built-in offline persistence** (IndexedDB-backed `persistentLocalCache`, multi-tab) is the entire sync engine. No third-party local-first framework (PowerSync/ElectricSQL/RxDB) — overkill for a single-user-per-account app.
- **Reads** serve from the local cache first (online or offline), so the UI is instant.
- **Writes** made offline are queued locally and flushed automatically on reconnect, surviving app restarts.
- **Conflict resolution:** last-write-wins (Firestore default). Correct for this app — one person, usually one device at a time; no collaborative editing.
- **UI pattern:** all views read through the cache so a just-logged set appears immediately even with no signal. Server timestamps (`loggedAt`) resolve locally then reconcile on sync.

## 7. Auth

- **Google Sign-In via `signInWithRedirect`** (redirect, not popup — reliable inside an installed PWA).
- Signed-out users see a login screen. All app routes and all data access are gated behind an authenticated user and scoped to `uid`.
- No email/password, magic-link, or anonymous auth in v1. Magic-link may be added later only if a specific user lacks a Google account.

## 8. Screens & feature parity

All screens from the current SwiftUI app are reproduced with the ice-palette design (ported from `Theme.swift` tokens and the current SwiftUI implementation, with the original `design/` mockup as secondary reference):

- **Today** — next-up card (day N of M, focus, lift/set counts), on-deck lift list, cycle dots (per-day status: DONE / NEXT / TO GO, tappable), start-day action, week-complete state with "start next cycle," and empty state → wizard.
- **Wizard** — build a program from effort / days-per-week / muscle groups / exercises; runs the ported TS engine to generate the program; writes it to Firestore.
- **Program library** — list of all programs; row → program detail.
- **Program detail** — make-active, rename, delete (with confirmation). Deleting a program preserves logged history (denormalized `programName`).
- **Day detail** — live mode (progress bar, per-lift completion checkmarks reacting to logged sets) and edit mode (reorder up/down, swap exercise, add lift, delete lift, adjust set count). "Complete day" marks the day done in the cycle and closes the open session.
- **Lift detail** — SET / WEIGHT / REPS / DONE grid; per-set toggle logs/unlogs a `loggedSet`; **prefill** from the last time the exercise was performed in any program (merging any sets already logged in the current session); **foreground-only rest timer** (visual countdown that flips to the accent color at `restAlertSec`; no background/OS notification).
- **History** — list of past sessions; label prefers the live program name, falls back to the denormalized `programName`, then "Deleted program."
- **More** — settings: rest-alert value (stepper, 30–300s), link to History.

### 8.1 Deliberate reduction from the Swift app

- **Rest timer is foreground-only.** The on-screen countdown remains while the app is open; the background local-notification (which fired even when the app was closed on iOS native) is removed, because iOS PWAs do not reliably support scheduled local notifications. Agreed acceptable — the timer is not a core feature.

## 9. Testing strategy

- **Engine** — ported unit tests + snapshot tests (Vitest); snapshot parity against the Swift golden files is the primary correctness gate.
- **App** — component/integration tests for the highest-value flows: program generation → persistence, set logging (log/unlog/toggle, single open session), cross-program prefill, and day/cycle completion.
- **Security rules** — tested against the **Firestore emulator**: a user can access only their own documents; cross-uid access is denied.
- **Manual QA** — an on-device PWA checklist (install to home screen, offline logging, reconnect sync, multi-device) analogous to the existing `docs/QA-CHECKLIST.md`.

## 10. Repository structure

- The PWA lives in a new **`web/`** subdirectory of this repo. The Swift app (`Riptide/`, `RiptideCore/`, `Riptide.xcodeproj`) remains as a living reference and possible parallel deployment.
- `docs/superpowers/` specs and plans at the repo root cover both targets.
- The shared `exercises.json` and snapshot fixtures are referenced by both engines; the exact file-sharing mechanism (symlink, copied-with-check, or direct path reference) is decided in the implementation plan.
- Cutover (archiving the Swift app, promoting `web/`) is **not** part of this spec; both coexist.

## 11. Out of scope (v1)

- Background / out-of-app rest-timer notifications (foreground-only in v1).
- Payments, premium tiers, and any feature requiring a secret key or server-side trust (would require a serverless function on the paid Blaze plan).
- Email/password, magic-link, and anonymous auth.
- Real exercise demo media (placeholder retained, as today).
- Native App Store packaging (Capacitor) — kept viable by the React choice, but not built here.
