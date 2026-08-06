import { useEffect, useState } from 'react';
import {
  onSnapshot, query, where, orderBy, limit, getDocs, doc, writeBatch, increment,
} from 'firebase/firestore';
import { db } from '../firebase';
import { sessionsCol, loggedSetsCol, sessionDoc } from './paths';
import type { SessionDoc, LoggedSetDoc } from './types';

export type SessionWithId = SessionDoc & { id: string };
export type LoggedSetWithId = LoggedSetDoc & { id: string };

// --- reactive reads ---

export function useOpenSession(uid: string | undefined): { session: SessionWithId | null; loading: boolean } {
  const [session, setSession] = useState<SessionWithId | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!uid) { setSession(null); setLoading(false); return; }
    setLoading(true);
    return onSnapshot(
      query(sessionsCol(uid), where('finishedAt', '==', null), limit(1)),
      (snap) => {
        const d = snap.docs[0];
        setSession(d ? { id: d.id, ...(d.data() as SessionDoc) } : null);
        setLoading(false);
      },
      (err) => { console.error('open session listener failed', err); setLoading(false); },
    );
  }, [uid]);
  return { session, loading };
}

export function useSessionSets(
  uid: string | undefined,
  sessionId: string | undefined,
): { sets: LoggedSetWithId[]; loading: boolean } {
  const [sets, setSets] = useState<LoggedSetWithId[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!uid || !sessionId) { setSets([]); setLoading(false); return; }
    setLoading(true);
    return onSnapshot(
      query(loggedSetsCol(uid), where('sessionId', '==', sessionId)),
      (snap) => {
        setSets(snap.docs.map((d) => ({ id: d.id, ...(d.data() as LoggedSetDoc) })));
        setLoading(false);
      },
      (err) => { console.error('session sets listener failed', err); setLoading(false); },
    );
  }, [uid, sessionId]);
  return { sets, loading };
}

// --- writes ---

export interface ToggleSetParams {
  programId: string;
  programName: string;
  dayIndex: number;
  exerciseId: string;
  exerciseName: string;
  setIndex: number;
  weight: number;
  reps: number;
}

// Port of SetLogger.toggle: resolve the open session for this day (creating it
// lazily and closing any stragglers to keep at-most-one-open), then add or
// remove the (exerciseId, setIndex) set, tracking setCount.
export async function toggleSet(uid: string, p: ToggleSetParams): Promise<void> {
  const openSnap = await getDocs(query(sessionsCol(uid), where('finishedAt', '==', null)));
  const openForDay = openSnap.docs.find((d) => (d.data() as SessionDoc).dayIndex === p.dayIndex);

  let sessionId: string;
  if (openForDay) {
    sessionId = openForDay.id;
  } else {
    const batch = writeBatch(db);
    openSnap.docs.forEach((d) => batch.update(d.ref, { finishedAt: Date.now() }));
    const ref = doc(sessionsCol(uid));
    const session: SessionDoc = {
      programId: p.programId, programName: p.programName, dayIndex: p.dayIndex,
      startedAt: Date.now(), finishedAt: null, setCount: 0,
    };
    batch.set(ref, session);
    await batch.commit();
    sessionId = ref.id;
  }

  const existing = await getDocs(
    query(
      loggedSetsCol(uid),
      where('sessionId', '==', sessionId),
      where('exerciseId', '==', p.exerciseId),
      where('setIndex', '==', p.setIndex),
    ),
  );
  const batch = writeBatch(db);
  if (!existing.empty) {
    existing.docs.forEach((d) => batch.delete(d.ref));
    batch.update(sessionDoc(uid, sessionId), { setCount: increment(-existing.size) });
  } else {
    const ref = doc(loggedSetsCol(uid));
    const set: LoggedSetDoc = {
      sessionId, exerciseId: p.exerciseId, exerciseName: p.exerciseName,
      setIndex: p.setIndex, weight: p.weight, reps: p.reps, dayIndex: p.dayIndex, loggedAt: Date.now(),
    };
    batch.set(ref, set);
    batch.update(sessionDoc(uid, sessionId), { setCount: increment(1) });
  }
  await batch.commit();
}
