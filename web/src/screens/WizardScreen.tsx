import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { createProgram } from '../data/programs';
import {
  ALL_EFFORTS, generate, effortLabel, DISPLAY_ORDER, muscleLabel, weeklyRange, ExerciseBank,
  type Effort, type MuscleGroup, type ExerciseDefinition,
} from '../core';
import { Eyebrow } from '../ui/Eyebrow';
import { IconChevronLeft, IconCheckSquare, IconSquare, IconX } from '../ui/icons';
import { useSmartBack } from '../hooks/useSmartBack';
import { toast } from '../ui/toast';

type Step = { kind: 'days' | 'muscles' | 'name' } | { kind: 'exercises'; i: number };

export function WizardScreen() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const exitWizard = useSmartBack('/program');

  const [step, setStep] = useState<Step>({ kind: 'days' });
  const [muscleEfforts, setMuscleEfforts] = useState<Partial<Record<MuscleGroup, Effort>>>({});
  const [days, setDays] = useState(0);
  const muscles = DISPLAY_ORDER.filter(m => muscleEfforts[m] !== undefined);
  const [picked, setPicked] = useState<Map<MuscleGroup, ExerciseDefinition[]>>(new Map());
  const [name, setName] = useState('');
  const [nameEdited, setNameEdited] = useState(false);
  const [busy, setBusy] = useState(false);

  const totalSteps = 3 + muscles.length;
  const stepIndex =
    step.kind === 'days' ? 0
    : step.kind === 'muscles' ? 1
    : step.kind === 'exercises' ? 2 + step.i
    : 2 + muscles.length; // name

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
      case 'days': return days !== 0;
      case 'muscles': return muscles.length > 0;
      case 'exercises': return pickedFor(muscles[step.i]).length > 0;
      case 'name': return name.trim().length > 0;
    }
  }, [step, days, muscles, picked, name]);

  const preview = step.kind === 'name' ? generate({ days, muscleEfforts, selections: picked }) : null;

  const nextLabel = step.kind === 'name' ? 'Build my program' : 'Continue';

  const back = () => {
    switch (step.kind) {
      case 'days': exitWizard(); break;
      case 'muscles': setStep({ kind: 'days' }); break;
      case 'exercises': setStep(step.i === 0 ? { kind: 'muscles' } : { kind: 'exercises', i: step.i - 1 }); break;
      case 'name': setStep({ kind: 'exercises', i: muscles.length - 1 }); break;
    }
  };

  const next = async () => {
    switch (step.kind) {
      case 'days': setStep({ kind: 'muscles' }); break;
      case 'muscles': setStep({ kind: 'exercises', i: 0 }); break;
      case 'exercises':
        if (step.i < muscles.length - 1) setStep({ kind: 'exercises', i: step.i + 1 });
        else {
          if (!nameEdited) setName(`${days}-Day ${new Set(Object.values(muscleEfforts)).size === 1 ? effortLabel(muscleEfforts[muscles[0]]!) : 'Custom'}`);
          setStep({ kind: 'name' });
        }
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
      const id = await createProgram(user.uid, { name: name.trim(), muscleEfforts, days, selections });
      // Replace so "back" from the new program never returns into the spent wizard.
      navigate(`/program/${id}`, { replace: true });
    } catch (err) {
      console.error('failed to build program', err);
      toast("Couldn't build the program — try again.");
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
          <div className="flex items-center gap-3">
            <Eyebrow>STEP {stepIndex + 1} OF {totalSteps}</Eyebrow>
            <button
              aria-label="close"
              onClick={exitWizard}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-stroke-strong text-ink"
            >
              <IconX className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="h-1 rounded-full bg-stroke">
          <div className="h-1 rounded-full bg-accent transition-all" style={{ width: `${progress * 100}%` }} />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        {step.kind === 'days' && (
          <Section title="How many days can you train?" sub="Days, not weekdays — miss one and the plan just waits.">
            <div className="flex flex-wrap gap-2">
              {[2, 3, 4, 5, 6, 7].map((d) => (
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
          <Section title="Set your priorities" sub="Choose a training level for each muscle. Skip leaves out direct work; other lifts may still train it.">
            {DISPLAY_ORDER.map(m => {
              const level = muscleEfforts[m];
              const range = level ? weeklyRange(m, level) : null;
              return (
                <fieldset key={m} className={`rounded-card border p-3 ${level ? 'border-accent/30 bg-accent/5' : 'border-stroke bg-card'}`}>
                  <legend className="sr-only">{muscleLabel(m)}</legend>
                  <div className="mb-3 flex items-baseline justify-between gap-2">
                    <span className="text-[15px] font-bold text-ink">{muscleLabel(m)}</span>
                    {range && <span className="text-[11px] text-ink-dim">{range.low}–{range.high} sets / week</span>}
                  </div>
                  <div className="grid grid-cols-4 gap-1 rounded-xl bg-input p-1">
                    {(['skip', ...ALL_EFFORTS] as const).map(option => (
                      <label key={option} className={`relative flex min-h-11 cursor-pointer items-center justify-center rounded-lg text-[12px] font-bold ${
                        (level ?? 'skip') === option ? option === 'skip' ? 'bg-card text-ink' : 'bg-accent text-on-accent shadow-sm' : 'text-ink-dim'
                      }`}>
                        <input type="radio" name={`effort-${m}`} value={option} checked={(level ?? 'skip') === option}
                          onChange={() => setMuscleEfforts(previous => {
                            const updated = { ...previous };
                            if (option === 'skip') delete updated[m]; else updated[m] = option;
                            return updated;
                          })}
                          className="absolute inset-0 h-full w-full cursor-pointer opacity-0 peer" />
                        <span className="pointer-events-none peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4">{option === 'skip' ? 'Skip' : effortLabel(option)}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              );
            })}
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
            <div className="rounded-card border border-stroke bg-card p-4">
              <p className="mb-3 text-sm font-bold text-ink">{days} days · {muscles.length} muscle groups</p>
              {muscles.map(m => <div key={m} className="flex justify-between py-1 text-sm"><span className="text-ink-dim">{muscleLabel(m)}</span><span className="text-accent">{effortLabel(muscleEfforts[m]!)}</span></div>)}
            </div>
            {!!preview?.shortfalls?.length && <div role="status" className="rounded-card border border-amber-400/40 bg-amber-400/10 p-4 text-sm text-ink">
              <p className="font-bold">Some volume won’t fit</p>
              {preview.shortfalls.map(s => <p key={s.muscle} className="mt-2">{muscleLabel(s.muscle)}: {s.achieved} of {s.target} target direct sets / week.</p>)}
              <p className="mt-2 text-ink-dim">Go back to add training days or more exercises for these muscles, or build with the lower volume shown.</p>
            </div>}
            <input
              aria-label="program name"
              value={name}
              onChange={(e) => { setName(e.target.value); setNameEdited(true); }}
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
