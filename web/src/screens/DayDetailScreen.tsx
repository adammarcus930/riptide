import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { useProgram, updateProgramDays } from '../data/programs';
import { useOpenSession, useSessionSets, completeDay } from '../data/workouts';
import { dayFocus } from '../data/materialize';
import { ExerciseBank, muscleLabel, type MuscleGroup } from '../core';
import type { ProgramDayDoc, PlannedLiftDoc } from '../data/types';
import { Eyebrow } from '../ui/Eyebrow';

export function DayDetailScreen() {
  const { id, dayIndex } = useParams<{ id: string; dayIndex: string }>();
  const { user } = useAuth();
  const { program, loading } = useProgram(user?.uid, id);
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const idx = Number(dayIndex);
  const { session } = useOpenSession(user?.uid);
  const liveSessionId = session && session.dayIndex === idx ? session.id : undefined;
  const { sets: sessionSets } = useSessionSets(user?.uid, liveSessionId);

  if (loading) return <main className="p-6 text-ink-faint">Loading…</main>;
  if (!program || !user || !id) return <main className="p-6 text-ink-dim">Not found.</main>;
  const day = program.days.find((d) => d.index === idx);
  if (!day) return <main className="p-6 text-ink-dim">Day not found.</main>;

  const lifts = [...day.lifts].sort((a, b) => a.order - b.order);
  const sets = lifts.reduce((s, l) => s + l.targetSets, 0);
  const doneIds = new Set(sessionSets.map((s) => s.exerciseId));
  const doneCount = lifts.filter((l) => doneIds.has(l.exerciseId)).length;
  const completed = day.completedInCycle ?? false;

  // Persist a mutated lift list for this day: re-index order, splice into days, save.
  const saveLifts = (nextLifts: PlannedLiftDoc[]) => {
    if (saving) return;
    const reindexed = nextLifts.map((l, i) => ({ ...l, order: i }));
    const nextDays: ProgramDayDoc[] = program.days.map((d) => (d.index === idx ? { ...d, lifts: reindexed } : d));
    setSaving(true);
    updateProgramDays(user.uid, id, nextDays)
      .catch((e) => console.error('failed to save day', e))
      .finally(() => setSaving(false));
  };

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= lifts.length) return;
    const copy = [...lifts];
    [copy[i], copy[j]] = [copy[j], copy[i]];
    saveLifts(copy);
  };
  const setSets = (i: number, n: number) =>
    saveLifts(lifts.map((l, k) => (k === i ? { ...l, targetSets: Math.max(1, Math.min(10, n)) } : l)));
  const remove = (i: number) => saveLifts(lifts.filter((_, k) => k !== i));
  const swap = (i: number, exId: string) => {
    const ex = ExerciseBank.find(exId);
    if (!ex) return;
    saveLifts(lifts.map((l, k) => (k === i ? { ...l, exerciseId: ex.id, exerciseName: ex.name, muscle: ex.primary, repRange: ex.repRange } : l)));
  };
  const add = (exId: string) => {
    const ex = ExerciseBank.find(exId);
    if (!ex) return;
    saveLifts([...lifts, { order: lifts.length, exerciseId: ex.id, exerciseName: ex.name, muscle: ex.primary, repRange: ex.repRange, targetSets: 3 }]);
    setAdding(false);
  };

  return (
    <main className="flex flex-col gap-4 p-6">
      <div className="flex items-start justify-between">
        <div>
          <Eyebrow className="text-accent">DAY {idx + 1}</Eyebrow>
          <h1 className="text-[30px] font-extrabold text-ink">{dayFocus(lifts) || 'Empty day'}</h1>
          <p className="text-[13px] text-ink-dim">{lifts.length} lifts · {sets} sets</p>
        </div>
        <button onClick={() => setEditing((v) => !v)} className="text-[14px] font-bold text-accent">
          {editing ? 'Done' : 'Edit'}
        </button>
      </div>

      {!editing && (
        <>
          <div className="h-1 rounded-full bg-stroke">
            <div className="h-1 rounded-full bg-accent transition-all"
                 style={{ width: `${lifts.length ? (doneCount / lifts.length) * 100 : 0}%` }} />
          </div>
          {lifts.map((lift) => {
            const done = doneIds.has(lift.exerciseId);
            return (
              <Link key={lift.order} to={`/program/${id}/day/${idx}/lift/${lift.order}`}
                    className="flex items-center gap-3 rounded-card border border-stroke bg-card p-4">
                <span className={done ? 'text-accent' : 'text-ink-faint'}>{done ? '☑' : '○'}</span>
                <div className="flex-1">
                  <p className="text-[15px] font-bold text-ink">{lift.exerciseName}</p>
                  <p className="text-[12px] text-ink-faint">{lift.targetSets} sets · {lift.repRange} reps</p>
                </div>
                <span className="text-ink-faint">›</span>
              </Link>
            );
          })}
          <button
            onClick={() => completeDay(user.uid, id, idx).catch((e) => console.error(e))}
            disabled={completed}
            className="mt-2 w-full rounded-btn bg-accent py-4 text-[15px] font-extrabold text-on-accent disabled:opacity-50"
          >
            {completed ? 'Day logged' : 'Complete day'}
          </button>
        </>
      )}

      {editing && (
        <>
          {lifts.map((lift, i) => (
            <div key={`${lift.exerciseId}-${i}`} className="rounded-card border border-stroke bg-card p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[15px] font-bold text-ink">{lift.exerciseName}</p>
                  <p className="text-[12px] text-ink-faint">{lift.targetSets} sets · {lift.repRange} reps · {muscleLabel(lift.muscle)}</p>
                </div>
                {editing && (
                  <div className="flex items-center gap-1">
                    <button aria-label={`up-${i}`} disabled={saving || i === 0} onClick={() => move(i, -1)} className="h-8 w-8 rounded-lg border border-stroke-strong text-ink disabled:opacity-30">↑</button>
                    <button aria-label={`down-${i}`} disabled={saving || i === lifts.length - 1} onClick={() => move(i, 1)} className="h-8 w-8 rounded-lg border border-stroke-strong text-ink disabled:opacity-30">↓</button>
                    <button aria-label={`delete-${i}`} disabled={saving} onClick={() => remove(i)} className="h-8 w-8 rounded-lg border border-stroke-strong text-ink-dim">✕</button>
                  </div>
                )}
              </div>
              {editing && (
                <div className="mt-3 flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <button aria-label={`sets-minus-${i}`} disabled={saving} onClick={() => setSets(i, lift.targetSets - 1)} className="h-8 w-8 rounded-lg border border-stroke-strong text-ink">−</button>
                    <span className="min-w-[52px] text-center text-[12px] font-extrabold text-ink">{lift.targetSets} sets</span>
                    <button aria-label={`sets-plus-${i}`} disabled={saving} onClick={() => setSets(i, lift.targetSets + 1)} className="h-8 w-8 rounded-lg border border-stroke-strong text-ink">+</button>
                  </div>
                  <select
                    aria-label={`swap-${i}`}
                    value={lift.exerciseId}
                    disabled={saving}
                    onChange={(e) => swap(i, e.target.value)}
                    className="rounded-lg border border-stroke-strong bg-input px-2 py-1 text-[12px] font-bold text-ink"
                  >
                    {ExerciseBank.exercisesFor(lift.muscle).map((alt) => (
                      <option key={alt.id} value={alt.id}>{alt.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          ))}

          {adding ? (
            <div className="rounded-card border border-stroke bg-card p-4">
              <Eyebrow>Add a lift</Eyebrow>
              <div className="mt-2 flex flex-col gap-2">
                {program.muscles.map((m: MuscleGroup) => (
                  <div key={m}>
                    <p className="text-[11px] font-extrabold uppercase tracking-[1px] text-accent">{muscleLabel(m)}</p>
                    {ExerciseBank.exercisesFor(m).map((ex) => (
                      <button key={ex.id} disabled={saving} onClick={() => add(ex.id)} className="flex w-full items-center justify-between py-1.5 text-left">
                        <span className="text-[14px] text-ink">{ex.name}</span>
                        <span className="text-[13px] font-extrabold text-accent">+ Add</span>
                      </button>
                    ))}
                  </div>
                ))}
              </div>
              <button onClick={() => setAdding(false)} className="mt-2 text-[13px] font-bold text-ink-dim">Close</button>
            </div>
          ) : (
            <button disabled={saving} onClick={() => setAdding(true)} className="rounded-btn border border-dashed border-stroke-strong py-3 text-[14px] font-bold text-ink">
              + Add a lift
            </button>
          )}
        </>
      )}
    </main>
  );
}
