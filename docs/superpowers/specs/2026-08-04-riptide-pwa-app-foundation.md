# Riptide PWA — Plan 2: App Foundation Design Spec

**Date:** 2026-08-04
**Status:** Approved (design), pending implementation plan
**Builds on:** `2026-08-02-riptide-pwa-design.md` (overall PWA architecture) and Plan 1 (the merged `web/src/core` engine).

## 1. Purpose

Turn the `web/` engine-only package into a running, installable PWA foundation: a Vite + React + TypeScript + Tailwind app with Firebase (Firestore + Auth) wired to the **Firebase Emulator Suite** for development, Google sign-in, the reactive data-layer pattern, security rules, and a thin authenticated vertical slice that proves the entire stack end-to-end (auth → gated routing → data layer → offline cache → rules → PWA shell). The final task is a guided, human-in-the-loop step to create the real Firebase project and perform the first deploy.

**This is Plan 2 of 3.** Plan 1 (engine) is done and merged. Plan 3 builds the real screens on this foundation.

**Non-goals for Plan 2:** the real Wizard/Today/Program/Day/Lift/History screens and their repositories (Plan 3); real exercise media; anything from the overall spec's out-of-scope list.

## 2. Goals & Constraints

- **Emulator-first.** All development and automated tests run against the Firebase Emulator Suite (Firestore + Auth). No cloud infrastructure is created until the final deploy task. Tests are hermetic.
- **The engine stays intact and DOM-free.** `web/src/core/**` is imported via its barrel and is not modified; it keeps compiling without DOM/React by convention.
- **Offline from the start.** Firestore is initialized with persistent local cache so the app works offline and syncs on reconnect.
- **The data-layer pattern established here is what Plan 3 reuses** for every collection.
- **Firebase web config keys are publishable** (not secrets — security rules do the protecting) but are still kept in `.env` so real values drop in cleanly.
- **Node 20+, npm, TypeScript strict, ESM** — carried over from Plan 1's `web/` package.

## 3. Architecture

### 3.1 Stack additions (on top of Plan 1's TS + Vitest package)

| Concern | Choice |
|---|---|
| Build/dev server | **Vite** + `@vitejs/plugin-react` |
| UI | **React 18** + TypeScript |
| Styling | **Tailwind CSS** (ice-palette tokens as theme values) + PostCSS/Autoprefixer |
| Routing | **React Router** (`react-router-dom`) |
| Backend SDK | **Firebase JS SDK v10** (modular): `firebase/app`, `firebase/auth`, `firebase/firestore` |
| Offline | Firestore **`persistentLocalCache`** (IndexedDB, multi-tab) |
| PWA | **`vite-plugin-pwa`** (Workbox) — manifest + service worker |
| Component tests | **Vitest** (jsdom) + **React Testing Library** + `@testing-library/jest-dom` |
| Rules tests | **`@firebase/rules-unit-testing`** against the Firestore emulator |
| Emulators | **Firebase CLI** Emulator Suite (Firestore + Auth) |

### 3.2 Topology (dev)

```
Browser (Vite dev server, http://localhost:5173)
   React app  ⇄  Firestore persistentLocalCache (IndexedDB)
        │
        ▼  (VITE_USE_EMULATOR=1)
  Firebase Emulator Suite (localhost): Auth emulator + Firestore emulator + Emulator UI (:4000)
```

In production the same app points at the real Firebase project via `.env` config (no emulator connection).

### 3.3 Directory layout (additions to `web/`)

```
web/
  index.html
  vite.config.ts              # react + vite-plugin-pwa plugins AND the Vitest `test` config (replaces vitest.config.ts)
  tailwind.config.js
  postcss.config.js
  .env.example                # VITE_FIREBASE_* placeholders + VITE_USE_EMULATOR
  firebase.json               # emulator ports + hosting config (public dir = dist)
  .firebaserc                 # created in the final deploy task, not before
  firestore.rules
  firestore.indexes.json
  src/
    core/                     # engine — UNCHANGED
    main.tsx                  # React entry: mounts <App/>
    App.tsx                   # BrowserRouter + AuthProvider + routes
    firebase.ts               # initializes app/auth/db; emulator wiring; persistentLocalCache
    index.css                 # Tailwind directives + base tokens
    theme.ts                  # ice-palette token constants (mirrors Swift Theme.swift)
    auth/
      AuthProvider.tsx        # context: user, loading, signIn(), signOut()
      useAuth.ts              # hook to consume the context
      RequireAuth.tsx         # route guard → redirects to /login when signed out
      LoginScreen.tsx         # "Sign in with Google" (redirect flow)
    data/
      paths.ts                # typed Firestore path helpers
      types.ts                # TypeScript types for ALL Firestore documents
      profile.ts              # setRestAlertSec() repository + useProfile() onSnapshot hook
    screens/
      AppShell.tsx            # tabbed authed layout (Today / Program / More) via <Outlet/>
      TodayScreen.tsx         # placeholder (Plan 3 replaces)
      ProgramScreen.tsx       # placeholder (Plan 3 replaces)
      MoreScreen.tsx          # REAL: rest-timer-alert stepper wired to useProfile/setRestAlertSec
    test/
      setup.ts                # RTL + jest-dom setup
      emulator.ts             # test helper: rules-unit-testing env + seed/cleanup utilities
```

## 4. Firebase initialization & offline

`src/firebase.ts`:
- Reads config from `import.meta.env` (`VITE_FIREBASE_API_KEY`, `…_AUTH_DOMAIN`, `…_PROJECT_ID`, `…_APP_ID`, etc.).
- Initializes Firestore via `initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) })` so reads serve from cache and offline writes queue and sync on reconnect.
- When `import.meta.env.VITE_USE_EMULATOR === '1'`: calls `connectAuthEmulator(auth, 'http://localhost:9099')` and `connectFirestoreEmulator(db, 'localhost', 8080)`. The emulator path requires no real credentials (a placeholder `projectId` like `riptide-dev` suffices).
- Exports singletons `app`, `auth`, `db`.

## 5. Auth

- `AuthProvider` subscribes to `onAuthStateChanged`, exposing `{ user, loading, signIn, signOut }`. `user` is the Firebase `User | null`.
- `signIn()` → `signInWithRedirect(auth, new GoogleAuthProvider())` (redirect, not popup — reliable in an installed PWA). On return, `getRedirectResult` is handled by the auth-state listener.
- `signOut()` → `firebaseSignOut(auth)`.
- `RequireAuth` renders the child route when `user` is present, redirects to `/login` otherwise; shows nothing (or a spinner) while `loading`.
- `LoginScreen` is a single "Sign in with Google" button in the ice-palette style. Against the Auth emulator, this drives the emulator's sign-in UI.

## 6. Data layer

### 6.1 Document types (`data/types.ts`)

TypeScript interfaces for every Firestore document, locking the schema from the overall spec §5:
- `Profile { restAlertSec: number }`
- `ProgramDoc { name: string; isActive: boolean; daysPerWeek: number; createdAt: number; days: ProgramDayDoc[] }`
- `ProgramDayDoc { index: number; focus: string; completedInCycle: boolean; lifts: PlannedLiftDoc[] }`
- `PlannedLiftDoc { exerciseId: string; exerciseName: string; muscle: MuscleGroup; repRange: string; targetSets: number; order: number }`
- `SessionDoc { programId: string; programName: string; dayIndex: number; startedAt: number; finishedAt: number | null }`
- `LoggedSetDoc { sessionId: string; exerciseId: string; exerciseName: string; setIndex: number; weight: number; reps: number; dayIndex: number; loggedAt: number }`

`MuscleGroup` is imported from `src/core` (single source of truth). Only `Profile` gets a repository/hook in Plan 2; the rest are the schema Plan 3 implements.

### 6.2 Path helpers (`data/paths.ts`)

Typed helpers returning Firestore refs, all namespaced under the signed-in uid: e.g. `profileDoc(uid)`, `programsCol(uid)`, `sessionsCol(uid)`, `loggedSetsCol(uid)`. Plan 3 consumes these.

### 6.3 Reactive pattern (`data/profile.ts`)

- **Write (repository function):** `setRestAlertSec(uid: string, seconds: number): Promise<void>` — `setDoc(profileDoc(uid), { restAlertSec }, { merge: true })`.
- **Read (reactive hook):** `useProfile(uid: string | undefined)` — subscribes via `onSnapshot(profileDoc(uid))`, returns `{ profile: Profile | null, loading }`. Serves from the offline cache and updates live. This is the exact pattern (repository write + `onSnapshot` read hook) Plan 3 repeats for programs/sessions/loggedSets.

## 7. Security rules

`firestore.rules`:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
  }
}
```
`firestore.indexes.json` declares the composite index for the future prefill query (`loggedSets` where `exerciseId ==` + `orderBy loggedAt desc`) so Plan 3's query works locally and in prod.

## 8. Vertical slice (definition of done for the foundation)

End-to-end, against the emulator, a user can:
1. Launch the app → see `LoginScreen`.
2. **Sign in with Google** (emulator UI) → redirected into the authed `AppShell`.
3. Navigate the tabs (Today/Program placeholders render; More is real).
4. On **More**, adjust **Rest timer alert** (30–300s stepper) → the change is written to Firestore via `setRestAlertSec` and reflected live by `useProfile`.
5. Works **offline**: with the network disabled the change persists locally and shows immediately; on reconnect it syncs.
6. **Sign out** → back to `LoginScreen`.

The More screen and the `profile`/`restAlertSec` data path are real and carried into Plan 3; the Today/Program placeholders are throwaway.

## 9. Styling

Tailwind configured with the ice-palette design tokens (mirroring the Swift `Theme.swift`: accent, background, card, strokes, text tints) as custom theme values in `tailwind.config.js`, surfaced via `theme.ts` constants where convenient. Enough tokens for the login screen, shell, and More screen; Plan 3 extends as needed.

## 10. PWA shell

`vite-plugin-pwa` (Workbox) configured for `registerType: 'autoUpdate'`, a web manifest (name "Riptide", `display: standalone`, theme/background colors from the ice palette), and precaching of the built app shell. Placeholder Riptide icons (a simple generated mark) at the required sizes (192/512, maskable). Real artwork can be swapped later.

## 11. Testing strategy

All against the emulator; hermetic; run in CI.
- **Security rules** (`@firebase/rules-unit-testing`): a user can read/write `/users/{ownUid}/…`; a different uid is denied read and write.
- **Auth/routing** (RTL): with no user, the app renders `LoginScreen`; with a mocked authed user, protected routes render `AppShell`. (Auth state is injectable so this doesn't require the live emulator.)
- **Data layer** (emulator integration): `setRestAlertSec` writes and `useProfile` reflects the value; an offline read via `disableNetwork(db)` then `enableNetwork(db)` shows the cached value is served while offline.
- **Engine tests** continue to pass unchanged (32/32).
- **Vitest environment:** default `jsdom` (with an RTL setup file); the engine's Node-oriented tests continue to pass under it.

## 12. Final task — create the real project & first deploy (human-in-the-loop)

A guided checklist executed by the **user** (I cannot create Google/Firebase resources):
1. Create a Firebase project in the console (free **Spark** plan; no card).
2. Enable **Authentication → Google** sign-in provider.
3. Register a **Web app**; copy its config into `web/.env` (from `.env.example`).
4. Create a **Cloud Firestore** database (production mode).
5. From `web/`: `firebase login`, `firebase use --add` (writes `.firebaserc`), then `firebase deploy --only firestore:rules,firestore:indexes,hosting` (after `npm run build`).
6. Smoke test the deployed URL: sign in with a real Google account, change the rest-timer value, confirm it persists; install to home screen on the phone.

This is the only step that creates cloud infrastructure. Everything before it is local/emulator.

## 13. Repository & tooling notes

- `vite.config.ts` absorbs the Vitest `test` config; `vitest.config.ts` is removed. `npm --prefix web run test` continues to work.
- `web/tsconfig.json` gains `"lib": ["ES2022", "DOM", "DOM.Iterable"]`, `"jsx": "react-jsx"`, and React/testing types; the engine remains DOM-free by convention (no DOM APIs used in `src/core`).
- New npm scripts: `dev` (vite), `build` (tsc + vite build), `preview`, `emulators` (firebase emulators:start), and `deploy` helpers. `sync:shared` and `typecheck` are retained.
- `.gitignore` adds `dist/`, `.firebase/`, and `web/.env` (real config never committed; `.env.example` is).

## 14. Out of scope (Plan 2)

- Real screens beyond the More slice and placeholders (Plan 3).
- Repositories/hooks for programs, sessions, loggedSets (Plan 3 — they follow the `profile.ts` pattern).
- Real app icons/artwork, exercise media.
- Background notifications, payments, non-Google auth (per overall spec).
