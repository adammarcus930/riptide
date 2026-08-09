import { Link } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { useProfile, setRestAlertSec } from '../data/profile';
import { Card } from '../ui/Card';
import { Eyebrow } from '../ui/Eyebrow';
import { IconChevronRight, IconMinus, IconPlus } from '../ui/icons';
import { toast } from '../ui/toast';

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
    setRestAlertSec(user.uid, Math.max(MIN, Math.min(MAX, next))).catch((err) => {
      console.error('failed to save rest alert', err);
      toast("Couldn't save the setting.");
    });
  };

  return (
    <main className="flex flex-col gap-4 p-6">
      <Eyebrow>More</Eyebrow>
      <h1 className="text-3xl font-extrabold text-ink">Riptide</h1>
      <Link to="/more/history" className="flex items-center justify-between rounded-card border border-stroke bg-card p-4 text-[15px] font-bold text-ink">
        History
        <IconChevronRight className="h-4 w-4 text-ink-faint" />
      </Link>
      <Card>
        <Eyebrow>Rest timer alert</Eyebrow>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-[15px] font-bold text-ink">{seconds} seconds</span>
          <div className="flex items-center gap-2">
            <button
              aria-label="decrease"
              onClick={() => set(seconds - STEP)}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-stroke-strong text-ink"
            >
              <IconMinus className="h-4 w-4" />
            </button>
            <button
              aria-label="increase"
              onClick={() => set(seconds + STEP)}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-stroke-strong text-ink"
            >
              <IconPlus className="h-4 w-4" />
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
