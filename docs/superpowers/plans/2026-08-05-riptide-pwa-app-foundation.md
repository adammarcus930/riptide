# Riptide PWA — Plan 2: App Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the `web/` engine package into a running, installable PWA — Vite/React/Tailwind app, Firebase (Firestore + Auth) wired to the emulator, Google sign-in, the reactive data-layer pattern, security rules, and a thin authed vertical slice (login → real More screen writing/reading `restAlertSec` live + offline → sign out) — ending with a guided step to create the real Firebase project and deploy.

**Architecture:** The existing `web/` package gains a React app alongside the untouched `src/core/` engine. Firebase runs against the local Emulator Suite in dev/test using the offline demo project id `demo-riptide` (no cloud resources). Reads use Firestore `onSnapshot` hooks (the cache is the store); writes go through typed repository functions. Tests split into a default hermetic tier (jsdom, no emulator) and an emulator tier (`firebase emulators:exec`).

**Tech Stack:** Vite 5 + React 18 + TypeScript (strict, ESM), Tailwind 3, React Router 6, Firebase JS SDK 10, vite-plugin-pwa, Vitest + React Testing Library + jsdom + fake-indexeddb, `@firebase/rules-unit-testing`, firebase-tools (local dev dep).

## Global Constraints

- **Node 20+** (present: v23); package manager **npm**; run everything via `npm --prefix web …` (never `cd`). npm scripts execute with cwd = `web/`, so `firebase`/`vitest`/`vite` resolve from `web/node_modules/.bin`.
- The `web/` package is **ESM**; **TypeScript strict**; `npm --prefix web run typecheck` must pass.
- **The engine (`web/src/core/**`) is NOT modified** and stays DOM-free. Import it only via its barrel `./core` / `../core`.
- **Emulator project id is `demo-riptide`.** The `demo-` prefix makes the Firebase emulators run fully offline with no real project, login, or credentials. Use it for dev and all emulator tests.
- **Java for the emulators** is provided by Homebrew OpenJDK. Emulator npm scripts MUST put it on PATH by prefixing `PATH="$(brew --prefix openjdk)/bin:$PATH"`. (OpenJDK is installed as a prerequisite before execution; if `$(brew --prefix openjdk)/bin/java -version` fails, STOP and report — do not attempt another JDK install.)
- **Two test tiers:**
  - `npm --prefix web run test` → Vitest (jsdom), **excludes** `**/*.emulator.test.*`. Hermetic, no Java/emulator. This is the default gate for every task.
  - `npm --prefix web run test:emulator` → starts the Firestore+Auth emulators and runs only `**/*.emulator.test.*`. Required for Tasks 3 and 5.
- **Firebase web config keys are publishable** but live in `.env` (`VITE_FIREBASE_*`); `web/.env` is git-ignored, `web/.env.example` is committed. The emulator path needs no real keys.
- Firestore is initialized with **`persistentLocalCache`** (multi-tab) so offline works.
- **Ice-palette tokens** (from `Riptide/Theme.swift`, exact hex): base `#0D1013`, card `#161B21`, input `#1C232B`, accent `#43C9FF`, on-accent `#04141D`, ink `#EEF3F7`, ink-dim `rgba(238,243,247,0.5)`, ink-faint `rgba(238,243,247,0.45)`, stroke `rgba(255,255,255,0.08)`, stroke-strong `rgba(255,255,255,0.12)`, stroke-dashed `rgba(255,255,255,0.22)`. Card radius 18px; accent button radius 14px.

---

## File Structure

```
web/
  index.html                       # Vite entry HTML (Task 1)
  vite.config.ts                   # react + PWA plugins + Vitest test config (Task 1, PWA added Task 6)
  vitest.emulator.config.ts        # emulator test include (Task 3)
  tailwind.config.js, postcss.config.js  # Task 1
  .env.example                     # Task 2
  firebase.json                    # emulator ports + hosting (Task 2, hosting finalized Task 6)
  firestore.rules                  # Task 3
  firestore.indexes.json           # Task 3
  src/
    core/                          # engine — UNCHANGED
    main.tsx                       # React entry (Task 1)
    App.tsx                        # providers + router (Task 1 minimal → Task 4 routes)
    index.css                      # Tailwind directives (Task 1)
    vite-env.d.ts                  # import.meta.env types (Task 2)
    firebase.ts                    # app/auth/db init + emulator wiring (Task 2)
    ui/
      Card.tsx, AccentButton.tsx, Eyebrow.tsx   # ice-palette primitives (Task 1)
    auth/
      AuthContext.ts               # context + types (Task 4)
      AuthProvider.tsx             # wraps Firebase Auth (Task 4)
      useAuth.ts                   # hook (Task 4)
      RequireAuth.tsx              # route guard (Task 4)
      LoginScreen.tsx              # Sign in with Google (Task 4)
    screens/
      AppShell.tsx                 # tab layout (Task 4)
      TodayScreen.tsx              # placeholder (Task 4)
      ProgramScreen.tsx            # placeholder (Task 4)
      MoreScreen.tsx               # real slice (Task 5)
    data/
      paths.ts                     # Firestore ref helpers (Task 5)
      types.ts                     # all document types (Task 5)
      profile.ts                   # setRestAlertSec + useProfile (Task 5)
    test/
      setup.ts                     # RTL + jest-dom + fake-indexeddb (Task 1)
      rules.emulator.test.ts       # Task 3
      profile.emulator.test.ts     # Task 5
```

---

### Task 1: Vite + React + Tailwind toolchain

**Files:**
- Modify: `web/package.json` (deps + scripts)
- Create: `web/index.html`, `web/vite.config.ts`, `web/tailwind.config.js`, `web/postcss.config.js`
- Delete: `web/vitest.config.ts` (absorbed into `vite.config.ts`)
- Create: `web/src/main.tsx`, `web/src/App.tsx`, `web/src/index.css`, `web/src/test/setup.ts`
- Create: `web/src/ui/Card.tsx`, `web/src/ui/AccentButton.tsx`, `web/src/ui/Eyebrow.tsx`
- Test: `web/src/App.test.tsx`, `web/src/ui/AccentButton.test.tsx`

**Interfaces:**
- Consumes: nothing from later tasks.
- Produces: a booting React app; `npm --prefix web run dev`/`build`; ice-palette primitives `Card`, `AccentButton` (`{ onClick?, type?, children }`), `Eyebrow` (`{ children, className? }`); Vitest running `.tsx` tests in jsdom with jest-dom matchers and fake-indexeddb.

- [ ] **Step 1: Add dependencies**

Run:
```
npm --prefix web install -D vite@^5.4 @vitejs/plugin-react@^4.3 tailwindcss@^3.4 postcss@^8.4 autoprefixer@^10.4 jsdom@^25 @testing-library/react@^16.0 @testing-library/jest-dom@^6.5 @testing-library/user-event@^14.5 fake-indexeddb@^6.0 @types/react@^18.3 @types/react-dom@^18.3
npm --prefix web install react@^18.3 react-dom@^18.3
```
Expected: installs succeed, exit 0.

- [ ] **Step 2: Update `web/package.json` scripts**

Replace the `scripts` block with:
```json
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit",
    "sync:shared": "node scripts/sync-shared.mjs"
  },
```
(Keep `"type": "module"`, `"private": true`. `test:emulator`, `emulators`, `deploy` are added in later tasks.)

- [ ] **Step 3: Update `web/tsconfig.json`**

Replace `compilerOptions` so React/JSX/DOM are available (engine stays DOM-free by convention — it uses no DOM APIs):
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "strict": true,
    "resolveJsonModule": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "noEmit": true,
    "types": ["node", "vitest/globals", "@testing-library/jest-dom"]
  },
  "include": ["src", "scripts"]
}
```

- [ ] **Step 4: Delete the standalone Vitest config**

Run: `git rm web/vitest.config.ts`
(The `test` config moves into `vite.config.ts` next.)

- [ ] **Step 5: Write `web/vite.config.ts`**

```ts
/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    exclude: ['**/node_modules/**', '**/*.emulator.test.{ts,tsx}'],
  },
});
```

- [ ] **Step 6: Write `web/index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <title>Riptide</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 7: Write Tailwind config `web/tailwind.config.js`**

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        base: '#0D1013',
        card: '#161B21',
        input: '#1C232B',
        accent: '#43C9FF',
        'on-accent': '#04141D',
        ink: '#EEF3F7',
        'ink-dim': 'rgba(238,243,247,0.5)',
        'ink-faint': 'rgba(238,243,247,0.45)',
        stroke: 'rgba(255,255,255,0.08)',
        'stroke-strong': 'rgba(255,255,255,0.12)',
        'stroke-dashed': 'rgba(255,255,255,0.22)',
      },
      borderRadius: { card: '18px', btn: '14px' },
    },
  },
  plugins: [],
};
```

- [ ] **Step 8: Write `web/postcss.config.js`**

```js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

- [ ] **Step 9: Write `web/src/index.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

html, body, #root { height: 100%; }
body { background: #0D1013; color: #EEF3F7; -webkit-font-smoothing: antialiased; }
```

- [ ] **Step 10: Write `web/src/test/setup.ts`**

```ts
import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';
```

- [ ] **Step 11: Write the ice-palette primitives**

`web/src/ui/Card.tsx`:
```tsx
import type { ReactNode } from 'react';

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-card border border-stroke bg-card p-4 ${className}`}>{children}</div>
  );
}
```

`web/src/ui/AccentButton.tsx`:
```tsx
import type { ReactNode } from 'react';

export function AccentButton({
  children,
  onClick,
  type = 'button',
}: {
  children: ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit';
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      className="w-full rounded-btn bg-accent py-4 text-[15px] font-extrabold text-on-accent active:scale-[0.98]"
    >
      {children}
    </button>
  );
}
```

`web/src/ui/Eyebrow.tsx`:
```tsx
import type { ReactNode } from 'react';

export function Eyebrow({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <span className={`text-[11px] font-extrabold uppercase tracking-[1.5px] text-ink-faint ${className}`}>
      {children}
    </span>
  );
}
```

- [ ] **Step 12: Write `web/src/App.tsx` (minimal for Task 1)**

```tsx
import { AccentButton } from './ui/AccentButton';
import { Eyebrow } from './ui/Eyebrow';

export default function App() {
  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col gap-4 p-6">
      <Eyebrow>Riptide</Eyebrow>
      <h1 className="text-4xl font-extrabold text-ink">Foundation</h1>
      <AccentButton>Ready</AccentButton>
    </main>
  );
}
```

- [ ] **Step 13: Write `web/src/main.tsx`**

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

- [ ] **Step 14: Write the failing tests**

`web/src/ui/AccentButton.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { test, expect, vi } from 'vitest';
import { AccentButton } from './AccentButton';

test('renders label and fires onClick', async () => {
  const onClick = vi.fn();
  render(<AccentButton onClick={onClick}>Go</AccentButton>);
  await userEvent.click(screen.getByRole('button', { name: 'Go' }));
  expect(onClick).toHaveBeenCalledOnce();
});
```

`web/src/App.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import { test, expect } from 'vitest';
import App from './App';

test('renders the foundation heading', () => {
  render(<App />);
  expect(screen.getByRole('heading', { name: 'Foundation' })).toBeInTheDocument();
});
```

- [ ] **Step 15: Run the failing tests**

Run: `npm --prefix web run test`
Expected: the two new tests FAIL first only if written before impl; since impl (Steps 11-12) is in place, instead confirm they PASS now. If any fail, fix before continuing. Engine tests (32) must still pass.

- [ ] **Step 16: Verify build + typecheck**

Run: `npm --prefix web run typecheck` → exit 0.
Run: `npm --prefix web run build` → completes, emits `web/dist/` (a successful production build proves the toolchain + JSX compile; no need to boot the dev server).

- [ ] **Step 17: Add `dist/` and Vite caches to gitignore**

Append to `web/.gitignore`:
```
dist/
*.local
```

- [ ] **Step 18: Commit**

```bash
git add web/package.json web/package-lock.json web/tsconfig.json web/vite.config.ts web/index.html web/tailwind.config.js web/postcss.config.js web/.gitignore web/src/main.tsx web/src/App.tsx web/src/App.test.tsx web/src/index.css web/src/test/setup.ts web/src/ui
git rm --cached web/vitest.config.ts 2>/dev/null; git add -u
git commit -m "feat(web): Vite + React + Tailwind toolchain and ice-palette primitives"
```

---

### Task 2: Firebase init, env & emulator wiring

**Files:**
- Modify: `web/package.json` (add `emulators` script + `firebase-tools` dev dep)
- Create: `web/.env.example`, `web/src/vite-env.d.ts`, `web/firebase.json`, `web/src/firebase.ts`
- Modify: `web/.gitignore`
- Test: `web/src/firebase.test.ts`

**Interfaces:**
- Consumes: nothing from later tasks.
- Produces: `web/src/firebase.ts` exporting singletons `app`, `auth`, `db`; emulator connection gated by `import.meta.env.VITE_USE_EMULATOR === '1'`. Emulator ports: Auth 9099, Firestore 8080, UI 4000.

- [ ] **Step 1: Add firebase + firebase-tools**

Run:
```
npm --prefix web install firebase@^10.13
npm --prefix web install -D firebase-tools@^13.20
```
Expected: exit 0.

- [ ] **Step 2: Add the `emulators` script to `web/package.json`**

Add to `scripts` (note the Java PATH prefix and demo project):
```json
    "emulators": "PATH=\"$(brew --prefix openjdk)/bin:$PATH\" firebase emulators:start --only auth,firestore --project demo-riptide",
```

- [ ] **Step 3: Write `web/src/vite-env.d.ts`**

```ts
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_USE_EMULATOR?: string;
  readonly VITE_FIREBASE_API_KEY?: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string;
  readonly VITE_FIREBASE_PROJECT_ID?: string;
  readonly VITE_FIREBASE_APP_ID?: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET?: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

- [ ] **Step 4: Write `web/.env.example`**

```
# Dev uses the Firebase emulators; no real keys needed.
VITE_USE_EMULATOR=1

# Real project values (filled in at the deploy step; publishable, not secrets).
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
```

- [ ] **Step 5: Write `web/firebase.json`**

```json
{
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  },
  "emulators": {
    "auth": { "port": 9099 },
    "firestore": { "port": 8080 },
    "ui": { "enabled": true, "port": 4000 },
    "singleProjectMode": true
  },
  "hosting": {
    "public": "dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [{ "source": "**", "destination": "/index.html" }]
  }
}
```

- [ ] **Step 6: Write `web/src/firebase.ts`**

```ts
import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  connectFirestoreEmulator,
} from 'firebase/firestore';

const useEmulator = import.meta.env.VITE_USE_EMULATOR === '1';

// In emulator mode the demo project id keeps everything offline; no real keys needed.
const config = useEmulator
  ? { apiKey: 'demo', projectId: 'demo-riptide', appId: 'demo' }
  : {
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      appId: import.meta.env.VITE_FIREBASE_APP_ID,
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    };

export const app = initializeApp(config);

export const auth = getAuth(app);

export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});

if (useEmulator) {
  connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, 'localhost', 8080);
}
```

- [ ] **Step 7: Write the failing test `web/src/firebase.test.ts`**

```ts
import { test, expect, vi } from 'vitest';

// Emulator mode so no real config is required and no network is touched.
vi.stubEnv('VITE_USE_EMULATOR', '1');

test('firebase module initializes singletons without throwing', async () => {
  const mod = await import('./firebase');
  expect(mod.app).toBeTruthy();
  expect(mod.auth).toBeTruthy();
  expect(mod.db).toBeTruthy();
});
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npm --prefix web run test`
Expected: PASS (firebase init + all prior tests). If init throws, fix before continuing.

- [ ] **Step 9: Verify the emulator boots with Java present**

Use `emulators:exec`, which starts the emulator, runs a command, and tears it down itself (no manual sleep/kill). Boot only the Auth emulator here — the Firestore emulator needs `firestore.rules`, which is created in Task 3.
Run:
```
cd web && PATH="$(brew --prefix openjdk)/bin:$PATH" npx firebase emulators:exec --only auth --project demo-riptide "true" && echo EMU_OK; cd ..
```
Expected: emulator starts, prints `EMU_OK`, shuts down. If it fails with `Unable to locate a Java Runtime`, STOP and report BLOCKED — the prerequisite OpenJDK install did not complete. (This is a one-off verification command; the reusable emulator scripts added in later tasks use `npm --prefix web run …`.)

- [ ] **Step 10: Update gitignore**

Append to `web/.gitignore`:
```
.env
.firebase/
firebase-debug.log
firestore-debug.log
ui-debug.log
```

- [ ] **Step 11: Commit**

```bash
git add web/package.json web/package-lock.json web/.env.example web/firebase.json web/src/vite-env.d.ts web/src/firebase.ts web/src/firebase.test.ts web/.gitignore
git commit -m "feat(web): Firebase init with emulator wiring and offline persistence"
```

---

### Task 3: Firestore security rules + emulator rules tests

**Files:**
- Create: `web/firestore.rules`, `web/firestore.indexes.json`
- Create: `web/vitest.emulator.config.ts`
- Modify: `web/package.json` (add `test:emulator` script)
- Test: `web/src/test/rules.emulator.test.ts`

**Interfaces:**
- Consumes: emulator config from Task 2 (`firebase.json`, `demo-riptide`).
- Produces: owner-only Firestore rules; `npm --prefix web run test:emulator` runs the emulator tier.

- [ ] **Step 1: Write `web/firestore.rules`**

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

- [ ] **Step 2: Write `web/firestore.indexes.json`**

```json
{
  "indexes": [
    {
      "collectionGroup": "loggedSets",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "exerciseId", "order": "ASCENDING" },
        { "fieldPath": "loggedAt", "order": "DESCENDING" }
      ]
    }
  ],
  "fieldOverrides": []
}
```

- [ ] **Step 3: Add firebase rules-unit-testing + the `test:emulator` script**

Run: `npm --prefix web install -D @firebase/rules-unit-testing@^3.0`

Add to `web/package.json` scripts:
```json
    "test:emulator": "PATH=\"$(brew --prefix openjdk)/bin:$PATH\" firebase emulators:exec --only auth,firestore --project demo-riptide \"vitest run --config vitest.emulator.config.ts\"",
```

- [ ] **Step 4: Write `web/vitest.emulator.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.emulator.test.{ts,tsx}'],
  },
});
```

- [ ] **Step 5: Write the failing test `web/src/test/rules.emulator.test.ts`**

```ts
import { beforeAll, afterAll, test, expect } from 'vitest';
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';
import { doc, getDoc, setDoc } from 'firebase/firestore';

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-riptide',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: 'localhost', port: 8080 },
  });
});
afterAll(async () => {
  await env.cleanup();
});

test('a user can read and write their own document', async () => {
  const db = env.authenticatedContext('alice').firestore();
  await assertSucceeds(setDoc(doc(db, 'users/alice/profile/main'), { restAlertSec: 180 }));
  await assertSucceeds(getDoc(doc(db, 'users/alice/profile/main')));
});

test("a user cannot read or write another user's document", async () => {
  const db = env.authenticatedContext('alice').firestore();
  await assertFails(setDoc(doc(db, 'users/bob/profile/main'), { restAlertSec: 90 }));
  await assertFails(getDoc(doc(db, 'users/bob/profile/main')));
});

test('an unauthenticated user is denied', async () => {
  const db = env.unauthenticatedContext().firestore();
  await assertFails(getDoc(doc(db, 'users/alice/profile/main')));
});
```

- [ ] **Step 6: Run the emulator tests to verify they pass**

Run: `npm --prefix web run test:emulator`
Expected: the emulator boots (Java on PATH), 3 rules tests PASS, emulator shuts down. If it fails because a rule is too permissive/strict, fix `firestore.rules` — do NOT weaken the test.

- [ ] **Step 7: Confirm the default tier still excludes emulator tests**

Run: `npm --prefix web run test`
Expected: PASS and the run does NOT include `rules.emulator.test.ts` (no emulator needed).

- [ ] **Step 8: Commit**

```bash
git add web/firestore.rules web/firestore.indexes.json web/vitest.emulator.config.ts web/package.json web/package-lock.json web/src/test/rules.emulator.test.ts
git commit -m "feat(web): owner-only Firestore rules with emulator rules tests"
```

---

### Task 4: Auth + routing shell

**Files:**
- Create: `web/src/auth/AuthContext.ts`, `web/src/auth/AuthProvider.tsx`, `web/src/auth/useAuth.ts`, `web/src/auth/RequireAuth.tsx`, `web/src/auth/LoginScreen.tsx`
- Create: `web/src/screens/AppShell.tsx`, `web/src/screens/TodayScreen.tsx`, `web/src/screens/ProgramScreen.tsx`
- Modify: `web/src/App.tsx` (router + providers)
- Add dep: `react-router-dom`
- Test: `web/src/auth/routing.test.tsx`

**Interfaces:**
- Consumes: `auth` from `../firebase` (Task 2); `Eyebrow`/`AccentButton` (Task 1).
- Produces:
  - `AuthContext` value type `AuthState = { user: User | null; loading: boolean; signIn: () => void; signOut: () => void }` and the React context (default undefined).
  - `useAuth(): AuthState`.
  - `AuthProvider` (wraps Firebase), `RequireAuth` (renders `<Outlet/>` if `user`, else `<Navigate to="/login"/>`), `LoginScreen`.
  - Routes: `/login` → LoginScreen; `/` guarded → AppShell with index `TodayScreen`, `/program` → ProgramScreen, `/more` → MoreScreen (added Task 5; use a placeholder route element until then).

- [ ] **Step 1: Add React Router**

Run: `npm --prefix web install react-router-dom@^6.26`

- [ ] **Step 2: Write `web/src/auth/AuthContext.ts`**

```ts
import { createContext } from 'react';
import type { User } from 'firebase/auth';

export interface AuthState {
  user: User | null;
  loading: boolean;
  signIn: () => void;
  signOut: () => void;
}

export const AuthContext = createContext<AuthState | undefined>(undefined);
```

- [ ] **Step 3: Write `web/src/auth/useAuth.ts`**

```ts
import { useContext } from 'react';
import { AuthContext, type AuthState } from './AuthContext';

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
```

- [ ] **Step 4: Write `web/src/auth/AuthProvider.tsx`**

```tsx
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithRedirect,
  signOut as fbSignOut,
  type User,
} from 'firebase/auth';
import { auth } from '../firebase';
import { AuthContext, type AuthState } from './AuthContext';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      signIn: () => void signInWithRedirect(auth, new GoogleAuthProvider()),
      signOut: () => void fbSignOut(auth),
    }),
    [user, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
```

- [ ] **Step 5: Write `web/src/auth/RequireAuth.tsx`**

```tsx
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './useAuth';

export function RequireAuth() {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-6 text-ink-faint">Loading…</div>;
  return user ? <Outlet /> : <Navigate to="/login" replace />;
}
```

- [ ] **Step 6: Write `web/src/auth/LoginScreen.tsx`**

```tsx
import { Navigate } from 'react-router-dom';
import { useAuth } from './useAuth';
import { AccentButton } from '../ui/AccentButton';
import { Eyebrow } from '../ui/Eyebrow';

export function LoginScreen() {
  const { user, signIn } = useAuth();
  if (user) return <Navigate to="/" replace />;
  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col justify-center gap-6 p-6">
      <Eyebrow>Riptide</Eyebrow>
      <h1 className="text-4xl font-extrabold text-ink">Train.</h1>
      <p className="text-ink-dim">Sign in to build and log your programs.</p>
      <AccentButton onClick={signIn}>Sign in with Google</AccentButton>
    </main>
  );
}
```

- [ ] **Step 7: Write the screens**

`web/src/screens/TodayScreen.tsx`:
```tsx
export function TodayScreen() {
  return <div className="p-6 text-ink">Today (coming in Plan 3)</div>;
}
```

`web/src/screens/ProgramScreen.tsx`:
```tsx
export function ProgramScreen() {
  return <div className="p-6 text-ink">Program (coming in Plan 3)</div>;
}
```

`web/src/screens/AppShell.tsx`:
```tsx
import { NavLink, Outlet } from 'react-router-dom';

const tabs = [
  { to: '/', label: 'Today', end: true },
  { to: '/program', label: 'Program', end: false },
  { to: '/more', label: 'More', end: false },
];

export function AppShell() {
  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col">
      <div className="flex-1"><Outlet /></div>
      <nav className="sticky bottom-0 flex border-t border-stroke bg-base">
        {tabs.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end}
            className={({ isActive }) =>
              `flex-1 py-3 text-center text-[12px] font-bold ${isActive ? 'text-accent' : 'text-ink-faint'}`
            }
          >
            {t.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
```

- [ ] **Step 8: Rewrite `web/src/App.tsx`**

```tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './auth/AuthProvider';
import { RequireAuth } from './auth/RequireAuth';
import { LoginScreen } from './auth/LoginScreen';
import { AppShell } from './screens/AppShell';
import { TodayScreen } from './screens/TodayScreen';
import { ProgramScreen } from './screens/ProgramScreen';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginScreen />} />
          <Route element={<RequireAuth />}>
            <Route element={<AppShell />}>
              <Route index element={<TodayScreen />} />
              <Route path="program" element={<ProgramScreen />} />
              <Route path="more" element={<div className="p-6 text-ink">More (Task 5)</div>} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
```

- [ ] **Step 9: Replace `web/src/App.test.tsx` and add the routing test**

Delete the old Task-1 App test content and write `web/src/auth/routing.test.tsx` (drives the guard via the raw context, no Firebase):
```tsx
import { render, screen } from '@testing-library/react';
import { test, expect } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuthContext, type AuthState } from './AuthContext';
import { RequireAuth } from './RequireAuth';
import { LoginScreen } from './LoginScreen';

function renderAt(path: string, value: AuthState) {
  return render(
    <AuthContext.Provider value={value}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/login" element={<LoginScreen />} />
          <Route element={<RequireAuth />}>
            <Route path="/" element={<div>PROTECTED</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}
const base = { loading: false, signIn: () => {}, signOut: () => {} };

test('signed-out user is redirected to the login screen', () => {
  renderAt('/', { ...base, user: null } as AuthState);
  expect(screen.getByRole('button', { name: /sign in with google/i })).toBeInTheDocument();
  expect(screen.queryByText('PROTECTED')).not.toBeInTheDocument();
});

test('signed-in user sees the protected route', () => {
  renderAt('/', { ...base, user: { uid: 'alice' } as never } as AuthState);
  expect(screen.getByText('PROTECTED')).toBeInTheDocument();
});
```

Then update `web/src/App.test.tsx` to assert the app renders the login screen for a signed-out user is covered by routing.test.tsx; delete `web/src/App.test.tsx` (its Task-1 heading no longer exists):
Run: `git rm web/src/App.test.tsx`

- [ ] **Step 10: Run tests**

Run: `npm --prefix web run test`
Expected: PASS — routing tests green, engine + firebase + ui tests green, no emulator needed.

- [ ] **Step 11: Typecheck + build**

Run: `npm --prefix web run typecheck` → exit 0.
Run: `npm --prefix web run build` → succeeds.

- [ ] **Step 12: Commit**

```bash
git add web/src/auth web/src/screens web/src/App.tsx web/package.json web/package-lock.json
git rm web/src/App.test.tsx 2>/dev/null; git add -u
git commit -m "feat(web): Google auth provider, route guard, login screen, tab shell"
```

---

### Task 5: Data layer + the More screen slice

**Files:**
- Create: `web/src/data/types.ts`, `web/src/data/paths.ts`, `web/src/data/profile.ts`
- Create: `web/src/screens/MoreScreen.tsx`
- Modify: `web/src/App.tsx` (wire the `/more` route to `MoreScreen`)
- Test: `web/src/data/profile.emulator.test.ts`, `web/src/screens/MoreScreen.test.tsx`

**Interfaces:**
- Consumes: `db` from `../firebase`; `useAuth` (Task 4); `MuscleGroup` from `../core`; `Card`/`Eyebrow` (Task 1).
- Produces:
  - `data/types.ts`: `Profile`, `ProgramDoc`, `ProgramDayDoc`, `PlannedLiftDoc`, `SessionDoc`, `LoggedSetDoc`.
  - `data/paths.ts`: `profileDoc(uid)`, `programsCol(uid)`, `sessionsCol(uid)`, `loggedSetsCol(uid)`.
  - `data/profile.ts`: `setRestAlertSec(uid, seconds): Promise<void>`; `useProfile(uid): { profile: Profile | null; loading: boolean }`.

- [ ] **Step 1: Write `web/src/data/types.ts`**

```ts
import type { MuscleGroup } from '../core';

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
  focus: string;
  completedInCycle: boolean;
  lifts: PlannedLiftDoc[];
}
export interface ProgramDoc {
  name: string;
  isActive: boolean;
  daysPerWeek: number;
  createdAt: number;
  days: ProgramDayDoc[];
}
export interface SessionDoc {
  programId: string;
  programName: string;
  dayIndex: number;
  startedAt: number;
  finishedAt: number | null;
}
export interface LoggedSetDoc {
  sessionId: string;
  exerciseId: string;
  exerciseName: string;
  setIndex: number;
  weight: number;
  reps: number;
  dayIndex: number;
  loggedAt: number;
}
```

- [ ] **Step 2: Write `web/src/data/paths.ts`**

```ts
import { collection, doc } from 'firebase/firestore';
import { db } from '../firebase';

export const profileDoc = (uid: string) => doc(db, 'users', uid, 'profile', 'main');
export const programsCol = (uid: string) => collection(db, 'users', uid, 'programs');
export const sessionsCol = (uid: string) => collection(db, 'users', uid, 'sessions');
export const loggedSetsCol = (uid: string) => collection(db, 'users', uid, 'loggedSets');
```

- [ ] **Step 3: Write `web/src/data/profile.ts`**

```ts
import { useEffect, useState } from 'react';
import { onSnapshot, setDoc } from 'firebase/firestore';
import { profileDoc } from './paths';
import type { Profile } from './types';

export async function setRestAlertSec(uid: string, seconds: number): Promise<void> {
  await setDoc(profileDoc(uid), { restAlertSec: seconds }, { merge: true });
}

export function useProfile(uid: string | undefined): { profile: Profile | null; loading: boolean } {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) {
      setProfile(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    return onSnapshot(profileDoc(uid), (snap) => {
      setProfile(snap.exists() ? (snap.data() as Profile) : null);
      setLoading(false);
    });
  }, [uid]);

  return { profile, loading };
}
```

- [ ] **Step 4: Write the emulator integration test `web/src/data/profile.emulator.test.ts`**

```ts
import { beforeAll, afterAll, test, expect } from 'vitest';
import { initializeApp, deleteApp, type FirebaseApp } from 'firebase/app';
import {
  getFirestore,
  connectFirestoreEmulator,
  doc,
  getDoc,
  getDocFromCache,
  setDoc,
  disableNetwork,
  enableNetwork,
} from 'firebase/firestore';

let app: FirebaseApp;
let db: ReturnType<typeof getFirestore>;

beforeAll(() => {
  app = initializeApp({ projectId: 'demo-riptide', apiKey: 'demo', appId: 'demo' }, 'profile-test');
  db = getFirestore(app);
  connectFirestoreEmulator(db, 'localhost', 8080);
});
afterAll(async () => {
  await deleteApp(app);
});

test('a written profile value is read back', async () => {
  const ref = doc(db, 'users/alice/profile/main');
  await setDoc(ref, { restAlertSec: 180 }, { merge: true });
  const snap = await getDoc(ref);
  expect(snap.data()).toEqual({ restAlertSec: 180 });
});

test('a cached value is served while offline', async () => {
  const ref = doc(db, 'users/alice/profile/main');
  await setDoc(ref, { restAlertSec: 120 }, { merge: true });
  await getDoc(ref); // prime the cache
  await disableNetwork(db);
  const cached = await getDocFromCache(ref);
  expect(cached.data()).toEqual({ restAlertSec: 120 });
  await enableNetwork(db);
});
```

- [ ] **Step 5: Run the emulator test to verify it passes**

Run: `npm --prefix web run test:emulator`
Expected: rules tests + the 2 profile tests PASS. If offline read fails, confirm `fake-indexeddb/auto` is in `src/test/setup.ts` — but note the emulator config uses the `node` environment; the offline test relies on the default in-memory cache via `getDocFromCache`, which works without IndexedDB. If it still fails, STOP and report the exact error.

- [ ] **Step 6: Write `web/src/screens/MoreScreen.tsx`**

```tsx
import { useAuth } from '../auth/useAuth';
import { useProfile, setRestAlertSec } from '../data/profile';
import { Card } from '../ui/Card';
import { Eyebrow } from '../ui/Eyebrow';

const DEFAULT_REST = 180;
const MIN = 30;
const MAX = 300;
const STEP = 15;

export function MoreScreen() {
  const { user, signOut } = useAuth();
  const { profile } = useProfile(user?.uid);
  const seconds = profile?.restAlertSec ?? DEFAULT_REST;

  const set = (next: number) => {
    if (!user) return;
    void setRestAlertSec(user.uid, Math.max(MIN, Math.min(MAX, next)));
  };

  return (
    <main className="flex flex-col gap-4 p-6">
      <Eyebrow>More</Eyebrow>
      <h1 className="text-3xl font-extrabold text-ink">Riptide</h1>
      <Card>
        <Eyebrow>Rest timer alert</Eyebrow>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-[15px] font-bold text-ink">{seconds} seconds</span>
          <div className="flex items-center gap-2">
            <button
              aria-label="decrease"
              onClick={() => set(seconds - STEP)}
              className="h-8 w-8 rounded-lg border border-stroke-strong text-ink"
            >
              −
            </button>
            <button
              aria-label="increase"
              onClick={() => set(seconds + STEP)}
              className="h-8 w-8 rounded-lg border border-stroke-strong text-ink"
            >
              +
            </button>
          </div>
        </div>
      </Card>
      <button onClick={signOut} className="text-[13px] font-bold text-ink-dim">
        Sign out
      </button>
    </main>
  );
}
```

- [ ] **Step 7: Wire the `/more` route**

In `web/src/App.tsx`, replace the placeholder more route element with `<MoreScreen />` and add the import `import { MoreScreen } from './screens/MoreScreen';`. The route becomes:
```tsx
            <Route path="more" element={<MoreScreen />} />
```

- [ ] **Step 8: Write the component test `web/src/screens/MoreScreen.test.tsx`**

Mock the data + auth modules so this stays in the default (no-emulator) tier:
```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { test, expect, vi, beforeEach } from 'vitest';

const setRestAlertSec = vi.fn();
vi.mock('../auth/useAuth', () => ({ useAuth: () => ({ user: { uid: 'alice' }, signOut: vi.fn() }) }));
vi.mock('../data/profile', () => ({
  setRestAlertSec: (...args: unknown[]) => setRestAlertSec(...args),
  useProfile: () => ({ profile: { restAlertSec: 180 }, loading: false }),
}));

import { MoreScreen } from './MoreScreen';

beforeEach(() => setRestAlertSec.mockClear());

test('shows the current rest value and increments it', async () => {
  render(<MoreScreen />);
  expect(screen.getByText('180 seconds')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'increase' }));
  expect(setRestAlertSec).toHaveBeenCalledWith('alice', 195);
});

test('decrements the rest value', async () => {
  render(<MoreScreen />);
  await userEvent.click(screen.getByRole('button', { name: 'decrease' }));
  expect(setRestAlertSec).toHaveBeenCalledWith('alice', 165);
});
```

- [ ] **Step 9: Run both test tiers**

Run: `npm --prefix web run test` → PASS (incl. MoreScreen, no emulator).
Run: `npm --prefix web run test:emulator` → PASS (rules + profile integration).
Run: `npm --prefix web run typecheck` → exit 0.

- [ ] **Step 10: Commit**

```bash
git add web/src/data web/src/screens/MoreScreen.tsx web/src/screens/MoreScreen.test.tsx web/src/data/profile.emulator.test.ts web/src/App.tsx
git commit -m "feat(web): profile data layer and live+offline More screen slice"
```

---

### Task 6: PWA shell (manifest + service worker)

**Files:**
- Modify: `web/vite.config.ts` (add `vite-plugin-pwa`)
- Create: `web/public/icon-192.png`, `web/public/icon-512.png`, `web/public/icon-maskable-512.png` (placeholder marks)
- Add dep: `vite-plugin-pwa`
- Test: `web/src/pwa.test.ts` (manifest options unit check)

**Interfaces:**
- Consumes: the Vite config from Task 1.
- Produces: a build that emits a web manifest + service worker; installable app shell.

- [ ] **Step 1: Add the plugin**

Run: `npm --prefix web install -D vite-plugin-pwa@^0.20`

- [ ] **Step 2: Generate placeholder icons**

Create simple solid accent-colored PNGs with the letter mark. Run:
```
node -e "const fs=require('fs');const b=Buffer;/* 1x1 accent pixel scaled by the browser is ugly; instead write minimal valid PNGs via a tiny generator */" 2>/dev/null
```
Since binary PNG generation inline is error-prone, create them with a small script instead — write `web/scripts/make-icons.mjs`:
```js
// Generates flat accent-colored square PNG placeholders at required sizes.
// Paths are resolved relative to this script (web/scripts) so cwd doesn't matter.
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

function png(size, [r, g, b]) {
  const crc = (buf) => {
    let c = ~0;
    for (const byte of buf) {
      c ^= byte;
      for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
    }
    return (~c) >>> 0;
  };
  const chunk = (type, data) => {
    const t = Buffer.from(type, 'ascii');
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const cr = Buffer.alloc(4);
    cr.writeUInt32BE(crc(Buffer.concat([t, data])));
    return Buffer.concat([len, t, data, cr]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 2; // 8-bit, truecolor RGB
  const row = Buffer.concat([Buffer.from([0]), Buffer.concat(Array(size).fill(Buffer.from([r, g, b])))]);
  const raw = Buffer.concat(Array(size).fill(row));
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

const publicDir = resolve(dirname(fileURLToPath(import.meta.url)), '../public');
mkdirSync(publicDir, { recursive: true });
const accent = [0x43, 0xc9, 0xff];
writeFileSync(resolve(publicDir, 'icon-192.png'), png(192, accent));
writeFileSync(resolve(publicDir, 'icon-512.png'), png(512, accent));
writeFileSync(resolve(publicDir, 'icon-maskable-512.png'), png(512, accent));
console.log('wrote placeholder icons');
```
Run: `node web/scripts/make-icons.mjs`
Expected: prints `wrote placeholder icons`; three PNGs exist under `web/public/`.

- [ ] **Step 3: Add the PWA plugin to `web/vite.config.ts`**

Update the plugins array and keep the existing `test` block:
```ts
/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export const pwaOptions = {
  registerType: 'autoUpdate' as const,
  manifest: {
    name: 'Riptide',
    short_name: 'Riptide',
    description: 'Build and log full-body lifting programs.',
    display: 'standalone' as const,
    background_color: '#0D1013',
    theme_color: '#0D1013',
    icons: [
      { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  },
};

export default defineConfig({
  plugins: [react(), VitePWA(pwaOptions)],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    exclude: ['**/node_modules/**', '**/*.emulator.test.{ts,tsx}'],
  },
});
```

- [ ] **Step 4: Write the manifest unit test `web/src/pwa.test.ts`**

```ts
import { test, expect } from 'vitest';
import { pwaOptions } from '../vite.config';

test('manifest is standalone with ice-palette colors and three icons', () => {
  expect(pwaOptions.manifest.name).toBe('Riptide');
  expect(pwaOptions.manifest.display).toBe('standalone');
  expect(pwaOptions.manifest.theme_color).toBe('#0D1013');
  expect(pwaOptions.manifest.icons).toHaveLength(3);
  expect(pwaOptions.manifest.icons.some((i) => i.purpose === 'maskable')).toBe(true);
});
```

- [ ] **Step 5: Run tests + build (build must emit the SW + manifest)**

Run: `npm --prefix web run test` → PASS (incl. pwa.test.ts).
Run: `npm --prefix web run build` → succeeds.
Run: `test -f web/dist/manifest.webmanifest && test -f web/dist/sw.js && echo PWA_BUILD_OK`
Expected: `PWA_BUILD_OK`.

- [ ] **Step 6: Commit**

```bash
git add web/vite.config.ts web/scripts/make-icons.mjs web/public web/src/pwa.test.ts web/package.json web/package-lock.json
git commit -m "feat(web): installable PWA shell (manifest + service worker)"
```

---

### Task 7: Real Firebase project & first deploy (human-in-the-loop)

**This task is executed by the user, not a subagent.** It is the only step that creates cloud infrastructure. The implementer/controller's job for this task is to (a) add the `deploy` npm script, (b) write a short `web/DEPLOY.md` checklist, then (c) hand the checklist to the user and STOP — do not attempt to create Firebase resources or run `firebase login`/`deploy` non-interactively.

**Files:**
- Modify: `web/package.json` (add `deploy` script)
- Create: `web/DEPLOY.md`

- [ ] **Step 1: Add the `deploy` script to `web/package.json`**

```json
    "deploy": "npm run build && firebase deploy --only firestore:rules,firestore:indexes,hosting",
```

- [ ] **Step 2: Write `web/DEPLOY.md`**

```markdown
# Deploying Riptide (first-time cloud setup)

Dev and tests run against the local emulators (`npm run emulators`, `npm run test:emulator`).
These steps create the real (free, Spark-tier) Firebase project and deploy — done once, by you.

1. **Create the project** at https://console.firebase.google.com → Add project (free Spark plan; no card).
2. **Enable Google sign-in:** Authentication → Sign-in method → enable **Google**.
   - Later, add your deployed hosting domain under Authentication → Settings → Authorized domains.
3. **Enable Firestore:** Build → Firestore Database → Create database → **production mode** → pick a region.
4. **Register a Web app:** Project settings → General → Your apps → Web (</>) → copy the config values into `web/.env`
   (copy `web/.env.example` to `web/.env` first) and set `VITE_USE_EMULATOR=0` there.
5. **Link the CLI and deploy** (from `web/`):
   ```
   export PATH="$(brew --prefix openjdk)/bin:$PATH"   # only needed if you also run emulators
   npm exec -- firebase login
   npm exec -- firebase use --add        # select the project; alias it "default" (writes .firebaserc)
   npm run deploy
   ```
6. **Smoke test:** open the printed Hosting URL, sign in with a real Google account, change the rest-timer
   value on More, reload → it persists. Add the Hosting domain to Authorized domains (step 2) if sign-in is blocked.
7. **Install to phone:** open the URL in Safari → Share → Add to Home Screen.
```

- [ ] **Step 3: Commit**

```bash
git add web/package.json web/DEPLOY.md
git commit -m "docs(web): deploy script and first-time Firebase setup checklist"
```

- [ ] **Step 4: Hand off**

Report the plan complete and present `web/DEPLOY.md` to the user as the manual next step. Do not run `firebase login` or `firebase deploy`.

---

## Self-Review

**1. Spec coverage (against `2026-08-04-riptide-pwa-app-foundation.md`):**
- §3.1 stack (Vite/React/Tailwind/Router/Firebase/PWA/testing) → Tasks 1, 2, 4, 6; test tooling Task 1.
- §3.3 directory layout → files created across Tasks 1–6 match.
- §4 Firebase init + offline (persistentLocalCache, emulator wiring, VITE_USE_EMULATOR) → Task 2.
- §5 auth (AuthProvider/useAuth/RequireAuth/LoginScreen, Google redirect) → Task 4.
- §6 data layer (types, paths, profile repo + onSnapshot hook) → Task 5.
- §7 security rules + indexes + rules tests → Task 3.
- §8 vertical slice (login → More writes/reads restAlertSec live + offline → sign out) → Tasks 4+5; offline verified by `profile.emulator.test.ts`.
- §9 styling (ice tokens) → Task 1 (`tailwind.config.js`, primitives).
- §10 PWA shell → Task 6.
- §11 testing (rules, auth/routing, data-layer incl. offline, engine unchanged, jsdom default) → Tasks 1,3,4,5; two-tier split enforced in configs.
- §12 real project & deploy checklist (human-in-the-loop) → Task 7.
- §13 tooling (vite absorbs vitest, tsconfig DOM/jsx, scripts, gitignore) → Tasks 1,2.

**2. Placeholder scan:** No TBD/TODO. Every step has full file contents or exact commands with expected output. Icon generation uses a concrete PNG-writing script rather than a vague "add icons."

**3. Type consistency:** `AuthState` shape identical in `AuthContext.ts`, `useAuth.ts`, and both consumers/tests. `Profile` shape (`{ restAlertSec }`) consistent across `types.ts`, `profile.ts`, `MoreScreen.tsx`, and tests. `setRestAlertSec(uid, seconds)` / `useProfile(uid)` signatures match between `profile.ts`, `MoreScreen.tsx`, and the mocked test. Path helper names (`profileDoc`/`programsCol`/`sessionsCol`/`loggedSetsCol`) match between `paths.ts` and `profile.ts`. Emulator project id `demo-riptide` and ports (9099/8080/4000) consistent across `firebase.ts`, `firebase.json`, both emulator test files, and the npm scripts.

**Environment dependency:** Tasks 2, 3, 5 require the Firestore/Auth emulators, which require OpenJDK on PATH (installed as a prerequisite; scripts prepend `$(brew --prefix openjdk)/bin`). Task 1 and the default `test` tier need no Java.

**Out of scope (Plan 3):** real Wizard/Today/Program/Day/Lift/History screens and their repositories/hooks (they follow the `profile.ts` pattern), real icon artwork, exercise media.
```
