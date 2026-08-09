import { useAuth } from '../auth/useAuth';
import { useHistory } from '../data/workouts';
import { useSmartBack } from '../hooks/useSmartBack';
import { Eyebrow } from '../ui/Eyebrow';
import { Skeleton } from '../ui/Skeleton';
import { IconChevronLeft } from '../ui/icons';
import { WaveMark } from '../ui/WaveMark';

export function HistoryScreen() {
  const { user } = useAuth();
  const { sessions, loading } = useHistory(user?.uid);
  const goBack = useSmartBack('/more');

  return (
    <main className="flex flex-col gap-3 p-6">
      <button
        onClick={goBack}
        aria-label="Back"
        className="inline-flex h-9 w-9 items-center justify-center self-start rounded-xl border border-stroke-strong text-ink"
      >
        <IconChevronLeft className="h-5 w-5" />
      </button>
      <Eyebrow>History</Eyebrow>
      <h1 className="text-3xl font-extrabold text-ink">Sessions</h1>
      {loading ? (
        <>
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </>
      ) : sessions.length === 0 ? (
        <div className="rounded-card border border-stroke bg-card p-5">
          <WaveMark className="mb-3 h-6 w-10 text-ink-faint" />
          <p className="text-[13px] text-ink-dim">Nothing logged yet — finish a workout and it lands here.</p>
        </div>
      ) : (
        sessions.map((s) => (
          <div key={s.id} className="rounded-card border border-stroke bg-card p-4">
            <div className="flex items-center justify-between">
              <span className="text-[15px] font-bold text-ink">
                {new Date(s.startedAt).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
              </span>
              <span className="text-[12px] font-semibold text-ink-faint">{s.setCount} sets</span>
            </div>
            <p className="text-[12px] text-ink-dim">
              {(s.programName || 'Deleted program')} · Day {s.dayIndex + 1}
            </p>
          </div>
        ))
      )}
    </main>
  );
}
