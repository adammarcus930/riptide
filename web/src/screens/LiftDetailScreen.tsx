import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { useProgram } from '../data/programs';
import { useProfile } from '../data/profile';
import { useOpenSession, useSessionSets, toggleSet, lastSets, mergedBySetIndex } from '../data/workouts';
import { useRestTimer } from '../hooks/useRestTimer';
import { ExerciseBank, muscleLabel } from '../core';
import { Eyebrow } from '../ui/Eyebrow';
import { IconChevronLeft, IconCheckCircle, IconCircle } from '../ui/icons';

const DEFAULT_REST = 180;

export function LiftDetailScreen() {
  const { id, dayIndex, order } = useParams<{ id: string; dayIndex: string; order: string }>();
  const { user } = useAuth();
  const { program, loading } = useProgram(user?.uid, id);
  const { profile } = useProfile(user?.uid);
  const { session, loading: sessionLoading } = useOpenSession(user?.uid);
  const timer = useRestTimer(profile?.restAlertSec ?? DEFAULT_REST);

  const idx = Number(dayIndex);
  const ord = Number(order);
  const day = program?.days.find((d) => d.index === idx);
  const lift = day?.lifts.find((l) => l.order === ord);

  const liveSessionId = session && session.dayIndex === idx ? session.id : undefined;
  const { sets: sessionSets, loading: setsLoading } = useSessionSets(user?.uid, liveSessionId);
  const mySets = sessionSets.filter((s) => s.exerciseId === lift?.exerciseId);

  const [weights, setWeights] = useState<string[]>([]);
  const [reps, setReps] = useState<string[]>([]);
  const [prefilled, setPrefilled] = useState(false);

  useEffect(() => {
    if (prefilled || !user || !lift || setsLoading || sessionLoading) return;
    (async () => {
      const previous = await lastSets(user.uid, lift.exerciseId, liveSessionId);
      const merged = mergedBySetIndex(mySets, previous);
      setWeights(Array.from({ length: lift.targetSets }, (_, i) => (merged.has(i) ? String(merged.get(i)!.weight) : '')));
      setReps(Array.from({ length: lift.targetSets }, (_, i) => (merged.has(i) ? String(merged.get(i)!.reps) : '')));
      setPrefilled(true);
    })();
  }, [prefilled, user, lift, setsLoading, sessionLoading, liveSessionId]);

  if (loading) return <main className="p-6 text-ink-faint">Loading…</main>;
  if (!program || !user || !id || !lift) return <main className="p-6 text-ink-dim">Lift not found.</main>;

  const doneIndices = new Set(mySets.map((s) => s.setIndex));

  const toggle = (i: number) => {
    const done = doneIndices.has(i);
    toggleSet(user.uid, {
      programId: id, programName: program.name, dayIndex: idx,
      exerciseId: lift.exerciseId, exerciseName: lift.exerciseName,
      setIndex: i, weight: Number(weights[i]) || 0, reps: Number(reps[i]) || 0,
    }).catch((e) => console.error('toggle set failed', e));
    // Completing a set (re)starts the rest countdown. Un-checking is a
    // correction — it must not touch the timer (that caused the buggy state).
    if (!done) timer.start();
  };

  const field = (arr: string[], set: (v: string[]) => void, i: number, placeholder: string) => (
    <input
      aria-label={placeholder + '-' + i}
      inputMode="decimal"
      value={arr[i] ?? ''}
      onChange={(e) => { const next = [...arr]; next[i] = e.target.value; set(next); }}
      placeholder={placeholder}
      className="w-full rounded-[11px] border border-stroke bg-input py-2 text-center text-[15px] font-bold text-ink"
    />
  );

  return (
    <main className="flex flex-col gap-4 p-6">
      <Link
        to={`/program/${id}/day/${idx}`}
        aria-label="Back to workout"
        className="inline-flex h-9 w-9 items-center justify-center self-start rounded-xl border border-stroke-strong text-ink"
      >
        <IconChevronLeft className="h-5 w-5" />
      </Link>
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <span className="self-start rounded-full bg-accent/10 px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.8px] text-accent">
            {muscleLabel(lift.muscle)}
          </span>
          {(ExerciseBank.find(lift.exerciseId)?.secondaries.length ?? 0) > 0 && (
            <span className="text-[12px] text-ink-dim">
              also hits {ExerciseBank.find(lift.exerciseId)!.secondaries.map(muscleLabel).join(', ')}
            </span>
          )}
        </div>
        <h1 className="text-[28px] font-extrabold text-ink">{lift.exerciseName}</h1>
      </div>

      <div className="grid grid-cols-[32px_1fr_1fr_44px] items-center gap-2">
        <Eyebrow>Set</Eyebrow><Eyebrow>Weight</Eyebrow><Eyebrow>Reps</Eyebrow><Eyebrow>Done</Eyebrow>
        {Array.from({ length: lift.targetSets }, (_, i) => {
          const done = doneIndices.has(i);
          return (
            <div key={i} className="contents">
              <span className="font-mono text-[15px] font-extrabold text-ink-dim">{i + 1}</span>
              {field(weights, setWeights, i, 'lb')}
              {field(reps, setReps, i, lift.repRange)}
              <button aria-label={`done-${i}`} onClick={() => toggle(i)} className="flex items-center justify-center">
                {done ? (
                  <IconCheckCircle className="animate-pop h-7 w-7 text-accent" />
                ) : (
                  <IconCircle className="h-7 w-7 text-ink-faint" />
                )}
              </button>
            </div>
          );
        })}
      </div>

      <div className="rounded-card border border-stroke bg-card p-4">
        <div className="flex items-center justify-between">
          <div>
            <Eyebrow>Rest timer</Eyebrow>
            <p
              className={`font-mono text-[28px] font-bold ${
                timer.past ? 'text-accent' : timer.running ? 'text-ink' : 'text-ink-faint'
              }`}
            >
              {timer.display}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {timer.past && <span className="animate-pop text-[13px] font-extrabold text-accent">Rest&apos;s up</span>}
            {timer.running && (
              <button
                onClick={() => timer.reset()}
                className="rounded-xl border border-stroke px-4 py-2 text-[13px] font-bold text-ink"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
