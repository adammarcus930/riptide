import { useAuth } from '../auth/useAuth';
import { useHistory } from '../data/workouts';
import { Eyebrow } from '../ui/Eyebrow';

export function HistoryScreen() {
  const { user } = useAuth();
  const { sessions, loading } = useHistory(user?.uid);

  return (
    <main className="flex flex-col gap-3 p-6">
      <Eyebrow>History</Eyebrow>
      <h1 className="text-3xl font-extrabold text-ink">Sessions</h1>
      {loading ? (
        <p className="text-ink-faint">Loading…</p>
      ) : sessions.length === 0 ? (
        <p className="text-[13px] text-ink-dim">Nothing logged yet — finish a workout and it lands here.</p>
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
