import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { useActiveProgram } from '../data/programs';
import { startNextCycle } from '../data/workouts';
import { dayFocus } from '../data/materialize';
import { Eyebrow } from '../ui/Eyebrow';

export function TodayScreen() {
  const { user } = useAuth();
  const { program, loading } = useActiveProgram(user?.uid);
  // null = follow the next-up day automatically; a number = user picked a day.
  const [picked, setPicked] = useState<number | null>(null);

  if (loading) return <main className="p-6 text-ink-faint">Loading…</main>;

  if (!program) {
    return (
      <main className="flex flex-col gap-4 p-6">
        <Eyebrow className="text-accent">Riptide</Eyebrow>
        <h1 className="text-4xl font-extrabold text-ink">Train.</h1>
        <div className="rounded-card border border-stroke bg-card p-5">
          <p className="text-[15px] font-bold text-ink">Build a program around your life.</p>
          <p className="mt-1 text-[13px] text-ink-dim">Tell Riptide how hard to push, how many days, and what to train.</p>
          <Link to="/wizard" className="mt-4 inline-block rounded-btn bg-accent px-5 py-3 text-[15px] font-extrabold text-on-accent shadow-cta">
            Build my program
          </Link>
        </div>
      </main>
    );
  }

  const days = [...program.days].sort((a, b) => a.index - b.index);
  const nextDay = days.find((d) => !d.completedInCycle) ?? null;
  const allDone = !nextDay;

  const selIndex = picked ?? nextDay?.index ?? days[0]?.index ?? 0;
  const selDay = days.find((d) => d.index === selIndex) ?? days[0];
  const status = (d: typeof selDay) =>
    d.completedInCycle ? 'DONE' : nextDay && d.index === nextDay.index ? 'NEXT' : 'TO GO';
  const setCount = selDay.lifts.reduce((s, l) => s + l.targetSets, 0);

  return (
    <main className="flex flex-col gap-5 p-6">
      <div className="flex items-baseline justify-between">
        <Eyebrow>Today</Eyebrow>
        <Eyebrow className="text-accent">Riptide</Eyebrow>
      </div>
      <h1 className="text-4xl font-extrabold text-ink">Train</h1>

      {/* Card for whichever day is selected (defaults to next up). */}
      <div className="rounded-[22px] bg-accent p-5 text-on-accent shadow-cta">
        <p className="text-[11px] font-extrabold tracking-[1.2px]">
          DAY {selDay.index + 1} OF {program.daysPerWeek} · {status(selDay)}
        </p>
        <p className="mt-1 text-[26px] font-extrabold tracking-[-0.02em]">{dayFocus(selDay.lifts) || 'Rest'}</p>
        <p className="mt-1 text-[13px] font-semibold opacity-70">
          {selDay.lifts.length} lifts · {setCount} sets
        </p>
        <Link
          to={`/program/${program.id}/day/${selDay.index}`}
          className="mt-4 block rounded-[14px] bg-on-accent py-4 text-center text-[15px] font-extrabold text-accent"
        >
          {selDay.completedInCycle ? 'Review' : 'Start'} day {selDay.index + 1}
        </Link>
      </div>

      <div className="flex flex-col gap-2">
        <Eyebrow>The lifts</Eyebrow>
        {[...selDay.lifts].sort((a, b) => a.order - b.order).map((l) => (
          <div key={l.order} className="flex items-center justify-between rounded-[13px] border border-stroke bg-card px-4 py-3">
            <span className="text-[14px] font-bold text-ink">{l.exerciseName}</span>
            <span className="text-[12px] font-semibold text-ink-faint">{l.targetSets} × {l.repRange}</span>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <Eyebrow>This cycle · tap a day</Eyebrow>
        <div className="flex gap-2">
          {days.map((d) => {
            const isSel = d.index === selIndex;
            const st = status(d);
            return (
              <button
                key={d.index}
                onClick={() => setPicked(d.index)}
                aria-label={`Day ${d.index + 1} ${st}`}
                className={`flex-1 rounded-[14px] py-3 text-center ${
                  isSel ? 'border-2 border-accent bg-card' : d.completedInCycle ? 'border border-accent/40 bg-accent/10' : 'border border-stroke bg-card'
                }`}
              >
                <div className="font-mono text-[16px] font-extrabold text-ink">{d.index + 1}</div>
                <div className={`text-[9px] font-bold tracking-[1px] ${st === 'TO GO' ? 'text-ink-faint' : 'text-accent'}`}>
                  {st}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {allDone && (
        <button
          onClick={() => { if (!user) return; startNextCycle(user.uid, program.id).catch((e) => console.error(e)); }}
          className="rounded-btn bg-accent py-4 text-[15px] font-extrabold text-on-accent shadow-cta"
        >
          Start next cycle
        </button>
      )}
    </main>
  );
}
