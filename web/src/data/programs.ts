import { useEffect, useState } from 'react';
import {
  onSnapshot, query, orderBy, where, getDocs, doc, writeBatch, updateDoc, deleteDoc,
} from 'firebase/firestore';
import { db } from '../firebase';
import { programsCol, programDoc } from './paths';
import { generate } from '../core';
import { materialize, toGeneratorInput, type NewProgramInput } from './materialize';
import type { ProgramDoc, ProgramDayDoc } from './types';

export type ProgramWithId = ProgramDoc & { id: string };

// --- writes ---

export async function createProgram(uid: string, input: NewProgramInput): Promise<string> {
  const data = materialize(generate(toGeneratorInput(input)), input);
  const existing = await getDocs(programsCol(uid));
  const batch = writeBatch(db);
  existing.forEach((d) => batch.update(d.ref, { isActive: false }));
  const ref = doc(programsCol(uid));
  batch.set(ref, data);
  await batch.commit();
  return ref.id;
}

export async function setActiveProgram(uid: string, id: string): Promise<void> {
  const existing = await getDocs(programsCol(uid));
  const batch = writeBatch(db);
  existing.forEach((d) => batch.update(d.ref, { isActive: d.id === id }));
  await batch.commit();
}

export async function renameProgram(uid: string, id: string, name: string): Promise<void> {
  await updateDoc(programDoc(uid, id), { name });
}

export async function deleteProgram(uid: string, id: string): Promise<void> {
  await deleteDoc(programDoc(uid, id));
}

export async function updateProgramDays(uid: string, id: string, days: ProgramDayDoc[]): Promise<void> {
  await updateDoc(programDoc(uid, id), { days });
}

// --- reactive reads ---

export function usePrograms(uid: string | undefined): { programs: ProgramWithId[]; loading: boolean } {
  const [programs, setPrograms] = useState<ProgramWithId[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!uid) { setPrograms([]); setLoading(false); return; }
    setLoading(true);
    return onSnapshot(
      query(programsCol(uid), orderBy('createdAt', 'desc')),
      (snap) => {
        setPrograms(snap.docs.map((d) => ({ id: d.id, ...(d.data() as ProgramDoc) })));
        setLoading(false);
      },
      (err) => { console.error('programs listener failed', err); setLoading(false); },
    );
  }, [uid]);
  return { programs, loading };
}

export function useProgram(
  uid: string | undefined,
  id: string | undefined,
): { program: ProgramWithId | null; loading: boolean } {
  const [program, setProgram] = useState<ProgramWithId | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!uid || !id) { setProgram(null); setLoading(false); return; }
    setLoading(true);
    return onSnapshot(
      programDoc(uid, id),
      (snap) => {
        setProgram(snap.exists() ? { id: snap.id, ...(snap.data() as ProgramDoc) } : null);
        setLoading(false);
      },
      (err) => { console.error('program listener failed', err); setLoading(false); },
    );
  }, [uid, id]);
  return { program, loading };
}

export function useActiveProgram(uid: string | undefined): { program: ProgramWithId | null; loading: boolean } {
  const [program, setProgram] = useState<ProgramWithId | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!uid) { setProgram(null); setLoading(false); return; }
    setLoading(true);
    return onSnapshot(
      query(programsCol(uid), where('isActive', '==', true)),
      (snap) => {
        const d = snap.docs[0];
        setProgram(d ? { id: d.id, ...(d.data() as ProgramDoc) } : null);
        setLoading(false);
      },
      (err) => { console.error('active program listener failed', err); setLoading(false); },
    );
  }, [uid]);
  return { program, loading };
}
