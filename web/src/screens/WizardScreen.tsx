import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { createProgram } from '../data/programs';
import {
  ALL_EFFORTS, allowedDays, effortLabel, DISPLAY_ORDER, muscleLabel, weeklyRange, ExerciseBank,
  type Effort, type MuscleGroup, type ExerciseDefinition,
} from '../core';
import { Eyebrow } from '../ui/Eyebrow';
import { IconChevronLeft, IconCheckSquare, IconSquare } from '../ui/icons';

type Step = { kind: 'effort' | 'days' | 'muscles' | 'name' } | { kind: 'exercises'; i: number };

const effortBlurb: Record<Effort, string> = {
  minimal: 'Maintain and stay consistent on a tight schedule.',
  optimal: 'The best growth-per-hour tradeoff. Most people, most of the time.',
  maximal: 'Everything you can productively recover from.',
};

export function WizardScreen() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>({ kind: 'effort' });
  const [effort, setEffort] = useState<Effort>('optimal');
  const [days, setDays] = useState(0);
  const [muscles, setMuscles] = useState<MuscleGroup[]>([]);
  const [picked, setPicked] = useState<Map<MuscleGroup, ExerciseDefinition[]>>(new Map());
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const totalSteps = 4 + muscles.length;
  const stepIndex =
    step.kind === 'effort' ? 0
    : step.kind === 'days' ? 1
    : step.kind === 'muscles' ? 2
    : step.kind === 'exercises' ? 3 + step.i
    : 3 + muscles.length; // name

  const progress = (stepIndex + 1) / totalSteps;

  const pickedFor = (m: MuscleGroup) => picked.get(m) ?? [];
  const togglePick = (m: MuscleGroup, ex: ExerciseDefinition) => {
    setPicked((prev) => {
      const next = new Map(prev);
      const cur = next.get(m) ?? [];
      next.set(m, cur.some((e) => e.id === ex.id) ? cur.filter((e) => e.id !== ex.id) : [...cur, ex]);
      return next;
    });
  };

  const canAdvance = useMemo(() => {
    switch (step.kind) {
      case 'effort': return true;
      case 'days': return days !== 0;
      case 'muscles': return muscles.length > 0;
      case 'exercises': return pickedFor(muscles[step.i]).length > 0;
      case 'name': return name.trim().length > 0;
    }
  }, [step, days, muscles, picked, name]);

  const nextLabel = step.kind === 'name' ? 'Build my program' : 'Continue';

  const back = () => {
    switch (step.kind) {
      case 'effort': navigate(-1); break;
      case 'days': setStep({ kind: 'effort' }); break;
      case 'muscles': setStep({ kind: 'days' }); break;
      case 'exercises': setStep(step.i === 0 ? { kind: 'muscles' } : { kind: 'exercises', i: step.i - 1 }); break;
      case 'name': setStep({ kind: 'exercises', i: muscles.length - 1 }); break;
    }
  };

  const next = async () => {
    switch (step.kind) {
      case 'effort': setStep({ kind: 'days' }); break;
      case 'days': setStep({ kind: 'muscles' }); break;
      case 'muscles': setStep({ kind: 'exercises', i: 0 }); break;
      case 'exercises':
        if (step.i < muscles.length - 1) setStep({ kind: 'exercises', i: step.i + 1 });
        else { setName(`${days}-Day ${effortLabel(effort)}`); setStep({ kind: 'name' }); }
        break;
      case 'name': await build(); break;
    }
  };

  const build = async () => {
    if (!user || busy) return;
    setBusy(true);
    try {
      const selections = new Map<MuscleGroup, ExerciseDefinition[]>();
      for (const m of muscles) selections.set(m, pickedFor(m));
      const id = await createProgram(user.uid, { name: name.trim(), effort, days, selections });
      navigate(`/program/${id}`);
    } catch (err) {
      console.error('failed to build program', err);
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col bg-base">
      <div className="flex flex-col gap-3 p-5">
        <div className="flex items-center justify-between">
          <button
            aria-label="back"
            onClick={back}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-stroke-strong text-ink"
          >
            <IconChevronLeft className="h-5 w-5" />
          </button>
          <Eyebrow>STEP {stepIndex + 1} OF {totalSteps}</Eyebrow>
        </div>
        <div className="h-1 rounded-full bg-stroke">
          <div className="h-1 rounded-full bg-accent transition-all" style={{ width: `${progress * 100}%` }} />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        {step.kind === 'effort' && (
          <Section title="How hard do you want to push?" sub="This sets your weekly training volume per muscle.">
            {ALL_EFFORTS.map((e) => {
              const r = weeklyRange('chest', e);
              return (
                <OptionCard key={e} selected={effort === e} onClick={() => { setEffort(e); if (!allowedDays(e).includes(days)) setDays(0); }}>
                  <div className="flex items-baseline justify-between">
                    <span className="text-[18px] font-extrabold text-ink">{effortLabel(e)}</span>
                    <span className="text-[12px] font-extrabold text-accent">~{r.low}–{r.high} sets / muscle / week</span>
                  </div>
                  <p className="mt-1 text-[13px] text-ink-dim">{effortBlurb[e]}</p>
                </OptionCard>
              );
            })}
          </Section>
        )}

        {step.kind === 'days' && (
          <Section title="How many days can you train?" sub="Days, not weekdays — miss one and the plan just waits.">
            <div className="flex flex-wrap gap-2">
              {allowedDays(effort).map((d) => (
                <button
                  key={d}
                  onClick={() => setDays(d)}
                  className={`min-w-[56px] flex-1 rounded-2xl border py-4 text-[24px] font-extrabold ${
                    days === d ? 'border-accent bg-accent/10 text-accent' : 'border-stroke bg-card text-ink'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </Section>
        )}

        {step.kind === 'muscles' && (
          <Section title="What do you want to train?" sub="Pick every muscle group this program should cover.">
            <div className="flex flex-wrap gap-2">
              {DISPLAY_ORDER.map((m) => {
                const on = muscles.includes(m);
                return (
                  <button
                    key={m}
                    onClick={() =>
                      setMuscles(on ? muscles.filter((x) => x !== m) : DISPLAY_ORDER.filter((x) => muscles.includes(x) || x === m))
                    }
                    className={`rounded-full border px-4 py-3 text-[14px] font-bold ${
                      on ? 'border-accent bg-accent/10 text-accent' : 'border-stroke bg-card text-ink'
                    }`}
                  >
                    {muscleLabel(m)}
                  </button>
                );
              })}
            </div>
          </Section>
        )}

        {step.kind === 'exercises' && (
          <Section
            title={muscleLabel(muscles[step.i])}
            sub="Pick the lifts you actually want to do. More picks = more variety."
            eyebrow={`MUSCLE ${step.i + 1} OF ${muscles.length}`}
          >
            {ExerciseBank.exercisesFor(muscles[step.i]).map((ex) => {
              const on = pickedFor(muscles[step.i]).some((e) => e.id === ex.id);
              return (
                <OptionCard key={ex.id} selected={on} onClick={() => togglePick(muscles[step.i], ex)}>
                  <div className="flex items-center gap-3">
                    {on ? (
                      <IconCheckSquare className="h-5 w-5 shrink-0 text-accent" />
                    ) : (
                      <IconSquare className="h-5 w-5 shrink-0 text-ink-faint" />
                    )}
                    <div>
                      <p className="text-[15px] font-bold text-ink">{ex.name}</p>
                      <p className="text-[12px] text-ink-faint">{ex.repRange} reps</p>
                    </div>
                  </div>
                </OptionCard>
              );
            })}
          </Section>
        )}

        {step.kind === 'name' && (
          <Section title="Name your program" sub="You can rename it anytime.">
            <input
              aria-label="program name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-card border border-stroke bg-input p-4 text-[20px] font-extrabold text-ink"
            />
          </Section>
        )}
      </div>

      <div className="p-5">
        <button
          onClick={next}
          disabled={!canAdvance || busy}
          className="w-full rounded-btn bg-accent py-4 text-[15px] font-extrabold text-on-accent shadow-cta disabled:opacity-40"
        >
          {busy ? 'Building…' : nextLabel}
        </button>
      </div>
    </div>
  );
}

function Section({ title, sub, eyebrow, children }: { title: string; sub: string; eyebrow?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4">
      {eyebrow && <Eyebrow className="text-accent">{eyebrow}</Eyebrow>}
      <div>
        <h1 className="text-[28px] font-extrabold text-ink">{title}</h1>
        <p className="mt-2 text-[13px] text-ink-dim">{sub}</p>
      </div>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  );
}

function OptionCard({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`w-full rounded-card border p-4 text-left ${selected ? 'border-accent bg-accent/10' : 'border-stroke bg-card'}`}
    >
      {children}
    </button>
  );
}
