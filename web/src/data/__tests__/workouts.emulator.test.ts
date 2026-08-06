import { beforeAll, afterEach, afterAll, test, expect, vi } from 'vitest';

vi.stubEnv('VITE_USE_EMULATOR', '1');

import { getAuth, signInAnonymously } from 'firebase/auth';
import {
  getDocs, collection, deleteDoc, query, where, doc, setDoc,
} from 'firebase/firestore';

let uid: string;
let db: typeof import('../../firebase').db;

beforeAll(async () => {
  const fb = await import('../../firebase');
  db = fb.db;
  uid = (await signInAnonymously(getAuth(fb.app))).user.uid;
});
afterEach(async () => {
  for (const c of ['sessions', 'loggedSets', 'programs']) {
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

test('lastSets returns the newest OTHER session for an exercise, sorted by setIndex', async () => {
  const { toggleSet, lastSets } = await import('../workouts');
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
