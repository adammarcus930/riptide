import { Link } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { usePrograms } from '../data/programs';
import { Eyebrow } from '../ui/Eyebrow';

export function ProgramLibraryScreen() {
  const { user } = useAuth();
  const { programs, loading } = usePrograms(user?.uid);

  return (
    <main className="flex flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <Eyebrow>Programs</Eyebrow>
        <Link to="/wizard" className="text-[13px] font-extrabold text-accent">
          + New program
        </Link>
      </div>
      <h1 className="text-3xl font-extrabold text-ink">Your programs</h1>

      {loading ? (
        <p className="text-ink-faint">Loading…</p>
      ) : programs.length === 0 ? (
        <div className="rounded-card border border-stroke bg-card p-5">
          <p className="text-[15px] font-bold text-ink">No programs yet.</p>
          <p className="mt-1 text-[13px] text-ink-dim">Build one and it becomes your active plan.</p>
          <Link
            to="/wizard"
            className="mt-4 inline-block rounded-btn bg-accent px-5 py-3 text-[15px] font-extrabold text-on-accent"
          >
            Build a program
          </Link>
        </div>
      ) : (
        programs.map((p) => (
          <Link
            key={p.id}
            to={`/program/${p.id}`}
            className="rounded-card border border-stroke bg-card p-4"
          >
            <div className="flex items-center justify-between">
              <span className="text-[16px] font-bold text-ink">{p.name}</span>
              {p.isActive && (
                <span className="rounded-full bg-accent/10 px-2 py-1 text-[10px] font-extrabold tracking-[1px] text-accent">
                  ACTIVE
                </span>
              )}
            </div>
            <p className="mt-1 text-[12px] text-ink-dim">{p.daysPerWeek} days · {p.days.length} sessions</p>
          </Link>
        ))
      )}
    </main>
  );
}
