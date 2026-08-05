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
