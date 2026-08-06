import { collection, doc } from 'firebase/firestore';
import { db } from '../firebase';

export const profileDoc = (uid: string) => doc(db, 'users', uid, 'profile', 'main');
export const programsCol = (uid: string) => collection(db, 'users', uid, 'programs');
export const sessionsCol = (uid: string) => collection(db, 'users', uid, 'sessions');
export const loggedSetsCol = (uid: string) => collection(db, 'users', uid, 'loggedSets');
export const programDoc = (uid: string, id: string) => doc(db, 'users', uid, 'programs', id);
export const sessionDoc = (uid: string, id: string) => doc(db, 'users', uid, 'sessions', id);
export const loggedSetDoc = (uid: string, id: string) => doc(db, 'users', uid, 'loggedSets', id);
