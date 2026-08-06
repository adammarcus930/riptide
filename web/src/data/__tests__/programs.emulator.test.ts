import { beforeAll, afterEach, test, expect, vi } from 'vitest';
import { signInAnonymously } from 'firebase/auth';
import { getDocs, collection, deleteDoc } from 'firebase/firestore';
import { ExerciseBank, ALL_MUSCLES, type MuscleGroup, type ExerciseDefinition } from '../../core';

// The repository reads db from ../firebase, which points at the emulator when
// VITE_USE_EMULATOR=1. Ensure that before importing it. (vi.stubEnv, not a direct
// assignment, because ImportMetaEnv declares VITE_USE_EMULATOR readonly — see
// src/firebase.test.ts for the same idiom.)
vi.stubEnv('VITE_USE_EMULATOR', '1');

let uid: string;

// Sign in and query through the SAME singleton app/db that ../programs uses (via
// ../firebase), rather than a second, disconnected Firebase app instance: Firestore
// attaches the ID token per-App, so a separate app's anonymous sign-in would leave
// the repository's own requests unauthenticated and every rule check would fail.
beforeAll(async () => {
  const { auth } = await import('../../firebase');
  uid = (await signInAnonymously(auth)).user.uid;
});
afterEach(async () => {
  const { db } = await import('../../firebase');
  const snap = await getDocs(collection(db, 'users', uid, 'programs'));
  await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
});

function input(name: string, days = 4) {
  const selections = new Map<MuscleGroup, ExerciseDefinition[]>();
  for (const m of ALL_MUSCLES) selections.set(m, ExerciseBank.exercisesFor(m).slice(0, 2));
  return { name, effort: 'optimal' as const, days, selections };
}
test('createProgram writes a program and it is the only active one', async () => {
  const { createProgram } = await import('../programs');
  const { db } = await import('../../firebase');
  await createProgram(uid, input('A'));
  await createProgram(uid, input('B'));
  const snap = await getDocs(collection(db, 'users', uid, 'programs'));
  const active = snap.docs.filter((d) => d.data().isActive);
  expect(snap.docs).toHaveLength(2);
  expect(active).toHaveLength(1);
  expect(active[0].data().name).toBe('B'); // newest created is active
});

test('setActiveProgram moves the active flag', async () => {
  const { createProgram, setActiveProgram } = await import('../programs');
  const { db } = await import('../../firebase');
  const aId = await createProgram(uid, input('A'));
  await createProgram(uid, input('B'));
  await setActiveProgram(uid, aId);
  const snap = await getDocs(collection(db, 'users', uid, 'programs'));
  const active = snap.docs.filter((d) => d.data().isActive);
  expect(active).toHaveLength(1);
  expect(active[0].id).toBe(aId);
});

test('renameProgram and deleteProgram work', async () => {
  const { createProgram, renameProgram, deleteProgram } = await import('../programs');
  const { db } = await import('../../firebase');
  const id = await createProgram(uid, input('A'));
  await renameProgram(uid, id, 'Renamed');
  let snap = await getDocs(collection(db, 'users', uid, 'programs'));
  expect(snap.docs[0].data().name).toBe('Renamed');
  await deleteProgram(uid, id);
  snap = await getDocs(collection(db, 'users', uid, 'programs'));
  expect(snap.docs).toHaveLength(0);
});
