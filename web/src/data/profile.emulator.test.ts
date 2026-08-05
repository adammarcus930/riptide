import { beforeAll, afterAll, test, expect } from 'vitest';
import { initializeApp, deleteApp, type FirebaseApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, signInAnonymously, type Auth } from 'firebase/auth';
import {
  initializeFirestore,
  memoryLocalCache,
  memoryLruGarbageCollector,
  connectFirestoreEmulator,
  doc,
  getDoc,
  getDocFromCache,
  setDoc,
  disableNetwork,
  enableNetwork,
  type Firestore,
} from 'firebase/firestore';

let app: FirebaseApp;
let db: Firestore;
let auth: Auth;
let uid: string;

// firestore.rules (Task 3) requires `request.auth != null && request.auth.uid == uid` on
// `users/{uid}/**`, so a live read/write test must authenticate against the Auth emulator
// first — an anonymous sign-in gives us a real uid to scope the profile doc path to.
beforeAll(async () => {
  app = initializeApp({ projectId: 'demo-riptide', apiKey: 'demo', appId: 'demo' }, 'profile-test');
  auth = getAuth(app);
  connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
  const cred = await signInAnonymously(auth);
  uid = cred.user.uid;
  // Plain getFirestore() defaults to an *eager* memory-GC cache, which evicts a document
  // the instant its last listener/read completes — so a later getDocFromCache() would find
  // nothing even though we're still "online" up to that point. An LRU memory cache retains
  // it without needing IndexedDB (unavailable in this test's node environment).
  db = initializeFirestore(app, {
    localCache: memoryLocalCache({ garbageCollector: memoryLruGarbageCollector() }),
  });
  connectFirestoreEmulator(db, 'localhost', 8080);
});
afterAll(async () => {
  await deleteApp(app);
});

test('a written profile value is read back', async () => {
  const ref = doc(db, 'users', uid, 'profile', 'main');
  await setDoc(ref, { restAlertSec: 180 }, { merge: true });
  const snap = await getDoc(ref);
  expect(snap.data()).toEqual({ restAlertSec: 180 });
});

test('a cached value is served while offline', async () => {
  const ref = doc(db, 'users', uid, 'profile', 'main');
  await setDoc(ref, { restAlertSec: 120 }, { merge: true });
  await getDoc(ref); // prime the cache
  await disableNetwork(db);
  const cached = await getDocFromCache(ref);
  expect(cached.data()).toEqual({ restAlertSec: 120 });
  await enableNetwork(db);
});
