import { useEffect, useState } from 'react';
import {
  onSnapshot, query, where, orderBy, limit, getDocs, doc, writeBatch, increment, getDoc, updateDoc,
} from 'firebase/firestore';
import { db } from '../firebase';
import { sessionsCol, loggedSetsCol, sessionDoc, loggedSetDoc, programDoc } from './paths';
import type { SessionDoc, LoggedSetDoc } from './types';
import type { ProgramDoc } from './types';

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
/** Live state the caller already holds (useOpenSession / useSessionSets). */
export interface ToggleContext {
  /** Current open session (any day) — or null if none. */
  openSession: SessionWithId | null;
  /** The already-logged docs for this (exerciseId, setIndex) in the open session. */
  existing: LoggedSetWithId[];
}

// One pure batched write, zero reads. The old version ran two server-first
// getDocs() before writing, so on weak signal each tap took seconds and rapid
// taps raced each other (checkmark flipping on-then-off). The screen already
// knows the open session and the set docs via live snapshots — trust them and
// let Firestore's latency compensation make the toggle instant.
export async function toggleSet(uid: string, p: ToggleSetParams, ctx: ToggleContext): Promise<void> {
  const batch = writeBatch(db);
  const reuse = ctx.openSession && ctx.openSession.dayIndex === p.dayIndex ? ctx.openSession : null;

  let sessionId: string;
  if (reuse) {
    sessionId = reuse.id;
  } else {
    // At-most-one-open: close the (differently-dayed) open session, start this
    // day's. A brand-new session always coincides with logging a set (there is
    // nothing to un-log yet), so it is born with setCount: 1.
    if (ctx.openSession) batch.update(sessionDoc(uid, ctx.openSession.id), { finishedAt: Date.now() });
    const ref = doc(sessionsCol(uid));
    const session: SessionDoc = {
      programId: p.programId, programName: p.programName, dayIndex: p.dayIndex,
      startedAt: Date.now(), finishedAt: null, setCount: 1,
    };
    batch.set(ref, session);
    sessionId = ref.id;
  }

  if (reuse && ctx.existing.length > 0) {
    ctx.existing.forEach((s) => batch.delete(loggedSetDoc(uid, s.id)));
    batch.update(sessionDoc(uid, sessionId), { setCount: increment(-ctx.existing.length) });
  } else {
    const ref = doc(loggedSetsCol(uid));
    const set: LoggedSetDoc = {
      sessionId, exerciseId: p.exerciseId, exerciseName: p.exerciseName,
      setIndex: p.setIndex, weight: p.weight, reps: p.reps, dayIndex: p.dayIndex, loggedAt: Date.now(),
    };
    batch.set(ref, set);
    if (reuse) batch.update(sessionDoc(uid, sessionId), { setCount: increment(1) });
  }
  await batch.commit();
}

// --- prefill (port of HistoryQueries.lastSets + merge) ---

export async function lastSets(
  uid: string,
  exerciseId: string,
  excludingSessionId?: string,
): Promise<LoggedSetWithId[]> {
  const snap = await getDocs(
    query(loggedSetsCol(uid), where('exerciseId', '==', exerciseId), orderBy('loggedAt', 'desc'), limit(50)),
  );
  const docs = snap.docs.map((d) => ({ id: d.id, ...(d.data() as LoggedSetDoc) }));
  const newest = docs.find((d) => d.sessionId !== excludingSessionId);
  if (!newest) return [];
  return docs.filter((d) => d.sessionId === newest.sessionId).sort((a, b) => a.setIndex - b.setIndex);
}

export interface SetValue { weight: number; reps: number }

export function mergedBySetIndex(
  current: { setIndex: number; weight: number; reps: number }[],
  previous: { setIndex: number; weight: number; reps: number }[],
): Map<number, SetValue> {
  const merged = new Map<number, SetValue>();
  for (const s of previous) merged.set(s.setIndex, { weight: s.weight, reps: s.reps });
  for (const s of current) merged.set(s.setIndex, { weight: s.weight, reps: s.reps });
  return merged;
}

// --- cycle / completion ---

export async function completeDay(uid: string, programId: string, dayIndex: number): Promise<void> {
  const pSnap = await getDoc(programDoc(uid, programId));
  if (pSnap.exists()) {
    const prog = pSnap.data() as ProgramDoc;
    const days = prog.days.map((d) => (d.index === dayIndex ? { ...d, completedInCycle: true } : d));
    await updateDoc(programDoc(uid, programId), { days });
  }
  const openSnap = await getDocs(query(sessionsCol(uid), where('finishedAt', '==', null)));
  const batch = writeBatch(db);
  openSnap.docs.forEach((d) => {
    if ((d.data() as SessionDoc).dayIndex === dayIndex) batch.update(d.ref, { finishedAt: Date.now() });
  });
  await batch.commit();
}

export async function startNextCycle(uid: string, programId: string): Promise<void> {
  const pSnap = await getDoc(programDoc(uid, programId));
  if (!pSnap.exists()) return;
  const prog = pSnap.data() as ProgramDoc;
  const days = prog.days.map((d) => ({ ...d, completedInCycle: false }));
  await updateDoc(programDoc(uid, programId), { days });
}

// --- history ---

export function useHistory(uid: string | undefined): { sessions: SessionWithId[]; loading: boolean } {
  const [sessions, setSessions] = useState<SessionWithId[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!uid) { setSessions([]); setLoading(false); return; }
    setLoading(true);
    return onSnapshot(
      query(sessionsCol(uid), orderBy('startedAt', 'desc'), limit(200)),
      (snap) => {
        setSessions(
          snap.docs
            .map((d) => ({ id: d.id, ...(d.data() as SessionDoc) }))
            .filter((s) => s.finishedAt !== null),
        );
        setLoading(false);
      },
      (err) => { console.error('history listener failed', err); setLoading(false); },
    );
  }, [uid]);
  return { sessions, loading };
}
