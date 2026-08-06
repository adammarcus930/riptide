import { Link } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { useActiveProgram } from '../data/programs';
import { startNextCycle } from '../data/workouts';
import { dayFocus } from '../data/materialize';
import { Eyebrow } from '../ui/Eyebrow';

export function TodayScreen() {
  const { user } = useAuth();
  const { program, loading } = useActiveProgram(user?.uid);

  if (loading) return <main className="p-6 text-ink-faint">Loading…</main>;

  if (!program) {
    return (
      <main className="flex flex-col gap-4 p-6">
        <Eyebrow className="text-accent">Riptide</Eyebrow>
        <h1 className="text-4xl font-extrabold text-ink">Train.</h1>
        <div className="rounded-card border border-stroke bg-card p-5">
          <p className="text-[15px] font-bold text-ink">Build a program around your life.</p>
          <p className="mt-1 text-[13px] text-ink-dim">Tell Riptide how hard to push, how many days, and what to train.</p>
          <Link to="/wizard" className="mt-4 inline-block rounded-btn bg-accent px-5 py-3 text-[15px] font-extrabold text-on-accent">
            Build my program
          </Link>
        </div>
      </main>
    );
  }

  const days = [...program.days].sort((a, b) => a.index - b.index);
  const nextDay = days.find((d) => !d.completedInCycle) ?? null;

  return (
    <main className="flex flex-col gap-5 p-6">
      <div className="flex items-baseline justify-between">
        <Eyebrow>Today</Eyebrow>
        <Eyebrow className="text-accent">Riptide</Eyebrow>
      </div>
      <h1 className="text-4xl font-extrabold text-ink">Train</h1>

      {nextDay ? (
        <>
          <div className="rounded-[22px] bg-accent p-5 text-on-accent">
            <p className="text-[11px] font-extrabold tracking-[1.2px]">NEXT UP · DAY {nextDay.index + 1} OF {program.daysPerWeek}</p>
            <p className="mt-1 text-[26px] font-extrabold">{dayFocus(nextDay.lifts) || 'Rest'}</p>
            <p className="mt-1 text-[13px] font-semibold opacity-70">
              {nextDay.lifts.length} lifts · {nextDay.lifts.reduce((s, l) => s + l.targetSets, 0)} sets
            </p>
            <Link
              to={`/program/${program.id}/day/${nextDay.index}`}
              className="mt-4 block rounded-[14px] bg-on-accent py-4 text-center text-[15px] font-extrabold text-accent"
            >
              Start day {nextDay.index + 1}
            </Link>
          </div>

          <div className="flex flex-col gap-2">
            <Eyebrow>The lifts</Eyebrow>
            {[...nextDay.lifts].sort((a, b) => a.order - b.order).map((l) => (
              <div key={l.order} className="flex items-center justify-between rounded-[13px] border border-stroke bg-card px-4 py-3">
                <span className="text-[14px] font-bold text-ink">{l.exerciseName}</span>
                <span className="text-[12px] font-semibold text-ink-faint">{l.targetSets} × {l.repRange}</span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="rounded-card border border-stroke bg-card p-5 text-center">
          <p className="text-[24px] font-extrabold text-accent">Week complete</p>
          <p className="mt-1 text-[13px] text-ink-dim">Every day in this cycle is logged. Start the next one when you’re ready.</p>
          <button
            onClick={() => { if (!user) return; startNextCycle(user.uid, program.id).catch((e) => console.error(e)); }}
            className="mt-4 w-full rounded-btn bg-accent py-4 text-[15px] font-extrabold text-on-accent"
          >
            Start next cycle
          </button>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <Eyebrow>This cycle</Eyebrow>
        <div className="flex gap-2">
          {days.map((d) => {
            const done = d.completedInCycle;
            const isNext = d.index === nextDay?.index;
            return (
              <div
                key={d.index}
                className={`flex-1 rounded-[14px] border py-3 text-center ${
                  done ? 'border-accent bg-accent/10' : isNext ? 'border-accent bg-card' : 'border-stroke bg-card'
                }`}
              >
                <div className="text-[16px] font-extrabold text-ink">{d.index + 1}</div>
                <div className={`text-[9px] font-bold tracking-[1px] ${done || isNext ? 'text-accent' : 'text-ink-faint'}`}>
                  {done ? 'DONE' : isNext ? 'NEXT' : 'TO GO'}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
