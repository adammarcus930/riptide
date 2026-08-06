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
