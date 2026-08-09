import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { useProgram, updateProgramDays } from '../data/programs';
import { useOpenSession, useSessionSets, completeDay } from '../data/workouts';
import { dayFocus } from '../data/materialize';
import { ExerciseBank, muscleLabel, type MuscleGroup } from '../core';
import type { ProgramDayDoc, PlannedLiftDoc } from '../data/types';
import { useSmartBack } from '../hooks/useSmartBack';
import { Eyebrow } from '../ui/Eyebrow';
import { ScreenSkeleton } from '../ui/Skeleton';
import { toast } from '../ui/toast';
import {
  IconChevronLeft, IconChevronRight, IconCheckCircle, IconCircle,
  IconArrowUp, IconArrowDown, IconX, IconPlus, IconMinus,
} from '../ui/icons';

export function DayDetailScreen() {
  const { id, dayIndex } = useParams<{ id: string; dayIndex: string }>();
  const { user } = useAuth();
  const { program, loading } = useProgram(user?.uid, id);
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  // Captured at the moment the day is completed, so the recap survives the
  // session closing (which empties the live set list).
  const [summary, setSummary] = useState<{ lifts: number; sets: number; left: number } | null>(null);
  const goBack = useSmartBack(`/program/${id}`);
  const idx = Number(dayIndex);
  const { session } = useOpenSession(user?.uid);
  const liveSessionId = session && session.dayIndex === idx ? session.id : undefined;
  const { sets: sessionSets } = useSessionSets(user?.uid, liveSessionId);

  if (loading) return <ScreenSkeleton />;
  if (!program || !user || !id) return <main className="p-6 text-ink-dim">Not found.</main>;
  const day = program.days.find((d) => d.index === idx);
  if (!day) return <main className="p-6 text-ink-dim">Day not found.</main>;

  const lifts = [...day.lifts].sort((a, b) => a.order - b.order);
  const sets = lifts.reduce((s, l) => s + l.targetSets, 0);
  // Honest progress: count sets logged per exercise (capped at plan), not
  // "touched this lift once". A lift is done when ALL its sets are in.
  const setsByExercise = new Map<string, number>();
  for (const s of sessionSets) setsByExercise.set(s.exerciseId, (setsByExercise.get(s.exerciseId) ?? 0) + 1);
  const loggedFor = (l: PlannedLiftDoc) => Math.min(setsByExercise.get(l.exerciseId) ?? 0, l.targetSets);
  const doneCount = lifts.filter((l) => loggedFor(l) >= l.targetSets).length;
  const loggedSetCount = lifts.reduce((n, l) => n + loggedFor(l), 0);
  const completed = day.completedInCycle ?? false;

  // Persist a mutated lift list for this day: re-index order, splice into days, save.
  const saveLifts = (nextLifts: PlannedLiftDoc[]) => {
    if (saving) return;
    const reindexed = nextLifts.map((l, i) => ({ ...l, order: i }));
    const nextDays: ProgramDayDoc[] = program.days.map((d) => (d.index === idx ? { ...d, lifts: reindexed } : d));
    setSaving(true);
    updateProgramDays(user.uid, id, nextDays)
      .catch((e) => {
        console.error('failed to save day', e);
        toast("Couldn't save your changes.");
      })
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
      <button
        onClick={goBack}
        aria-label="Back"
        className="inline-flex h-9 w-9 items-center justify-center self-start rounded-xl border border-stroke-strong text-ink"
      >
        <IconChevronLeft className="h-5 w-5" />
      </button>
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
                 style={{ width: `${sets ? (loggedSetCount / sets) * 100 : 0}%` }} />
          </div>
          {lifts.map((lift) => {
            const logged = loggedFor(lift);
            const done = logged >= lift.targetSets;
            return (
              <Link key={lift.order} to={`/program/${id}/day/${idx}/lift/${lift.order}`}
                    className="flex items-center gap-3 rounded-card border border-stroke bg-card p-4">
                {done ? (
                  <span role="img" aria-label="done">
                    <IconCheckCircle className="animate-pop h-6 w-6 text-accent" />
                  </span>
                ) : logged > 0 ? (
                  <span className="flex h-6 min-w-[26px] items-center justify-center rounded-full border border-accent/50 px-1 font-mono text-[10px] font-extrabold text-accent">
                    {logged}/{lift.targetSets}
                  </span>
                ) : (
                  <IconCircle className="h-6 w-6 text-ink-faint" />
                )}
                <div className="flex-1">
                  <p className="text-[15px] font-bold text-ink">{lift.exerciseName}</p>
                  <p className="text-[12px] text-ink-faint">{lift.targetSets} sets · {lift.repRange} reps</p>
                </div>
                <IconChevronRight className="h-4 w-4 text-ink-faint" />
              </Link>
            );
          })}
          {summary ? (
            <div className="animate-pop mt-2 rounded-card border border-accent/40 bg-accent/10 p-4">
              <p className="text-[16px] font-extrabold text-accent">Day {idx + 1} done.</p>
              <p className="mt-1 text-[13px] text-ink-dim">
                {summary.lifts} of {lifts.length} lifts · {summary.sets} sets logged.{' '}
                {summary.left > 0
                  ? `${summary.left} day${summary.left === 1 ? '' : 's'} left in this cycle.`
                  : 'That was the last day of the cycle.'}
              </p>
            </div>
          ) : (
            <button
              onClick={() => {
                setSummary({
                  lifts: doneCount,
                  sets: sessionSets.length,
                  left: program.days.filter((d) => !d.completedInCycle && d.index !== idx).length,
                });
                completeDay(user.uid, id, idx).catch((e) => {
                  console.error(e);
                  toast("Couldn't complete the day.");
                });
              }}
              disabled={completed}
              className="mt-2 w-full rounded-btn bg-accent py-4 text-[15px] font-extrabold text-on-accent shadow-cta disabled:opacity-50"
            >
              {completed ? 'Day logged' : 'Complete day'}
            </button>
          )}
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
                    <button aria-label={`up-${i}`} disabled={saving || i === 0} onClick={() => move(i, -1)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-stroke-strong text-ink disabled:opacity-30"><IconArrowUp className="h-4 w-4" /></button>
                    <button aria-label={`down-${i}`} disabled={saving || i === lifts.length - 1} onClick={() => move(i, 1)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-stroke-strong text-ink disabled:opacity-30"><IconArrowDown className="h-4 w-4" /></button>
                    <button aria-label={`delete-${i}`} disabled={saving} onClick={() => remove(i)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-stroke-strong text-ink-dim"><IconX className="h-4 w-4" /></button>
                  </div>
                )}
              </div>
              {editing && (
                <div className="mt-3 flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <button aria-label={`sets-minus-${i}`} disabled={saving} onClick={() => setSets(i, lift.targetSets - 1)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-stroke-strong text-ink"><IconMinus className="h-4 w-4" /></button>
                    <span className="min-w-[52px] text-center text-[12px] font-extrabold text-ink">{lift.targetSets} sets</span>
                    <button aria-label={`sets-plus-${i}`} disabled={saving} onClick={() => setSets(i, lift.targetSets + 1)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-stroke-strong text-ink"><IconPlus className="h-4 w-4" /></button>
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
