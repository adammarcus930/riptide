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
