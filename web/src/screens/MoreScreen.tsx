import { useAuth } from '../auth/useAuth';
import { useProfile, setRestAlertSec } from '../data/profile';
import { Card } from '../ui/Card';
import { Eyebrow } from '../ui/Eyebrow';

const DEFAULT_REST = 180;
const MIN = 30;
const MAX = 300;
const STEP = 15;

export function MoreScreen() {
  const { user, signOut } = useAuth();
  const { profile } = useProfile(user?.uid);
  const seconds = profile?.restAlertSec ?? DEFAULT_REST;

  const set = (next: number) => {
    if (!user) return;
    void setRestAlertSec(user.uid, Math.max(MIN, Math.min(MAX, next)));
  };

  return (
    <main className="flex flex-col gap-4 p-6">
      <Eyebrow>More</Eyebrow>
      <h1 className="text-3xl font-extrabold text-ink">Riptide</h1>
      <Card>
        <Eyebrow>Rest timer alert</Eyebrow>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-[15px] font-bold text-ink">{seconds} seconds</span>
          <div className="flex items-center gap-2">
            <button
              aria-label="decrease"
              onClick={() => set(seconds - STEP)}
              className="h-8 w-8 rounded-lg border border-stroke-strong text-ink"
            >
              −
            </button>
            <button
              aria-label="increase"
              onClick={() => set(seconds + STEP)}
              className="h-8 w-8 rounded-lg border border-stroke-strong text-ink"
            >
              +
            </button>
          </div>
        </div>
      </Card>
      <button onClick={signOut} className="text-[13px] font-bold text-ink-dim">
        Sign out
      </button>
    </main>
  );
}
