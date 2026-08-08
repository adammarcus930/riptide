import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { useProgram, setActiveProgram, renameProgram, deleteProgram } from '../data/programs';
import { dayFocus } from '../data/materialize';
import { effortLabel } from '../core';
import { Eyebrow } from '../ui/Eyebrow';

export function ProgramDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { program, loading } = useProgram(user?.uid, id);

  const [renaming, setRenaming] = useState(false);
  const [nameBuf, setNameBuf] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (loading) return <main className="p-6 text-ink-faint">Loading…</main>;
  if (!program || !user || !id) return <main className="p-6 text-ink-dim">Program not found.</main>;

  const commitRename = () => {
    if (!renaming) return;
    const trimmed = nameBuf.trim();
    setRenaming(false);
    if (trimmed && trimmed !== program.name) renameProgram(user.uid, id, trimmed).catch((e) => console.error(e));
  };

  return (
    <main className="flex flex-col gap-4 p-6">
      <Link
        to="/program"
        aria-label="Back to programs"
        className="inline-flex h-9 w-9 items-center justify-center self-start rounded-xl border border-stroke-strong text-[18px] text-ink"
      >
        ‹
      </Link>
      <div className="flex items-center justify-between">
        <Eyebrow className={program.isActive ? 'text-accent' : undefined}>
          {program.isActive ? 'ACTIVE PROGRAM' : 'PROGRAM'}
        </Eyebrow>
        {!program.isActive && (
          <button
            onClick={() => setActiveProgram(user.uid, id).catch((e) => console.error(e))}
            className="rounded-full border border-accent/40 bg-accent/10 px-3 py-1.5 text-[12px] font-extrabold text-accent"
          >
            Make active
          </button>
        )}
      </div>

      {renaming ? (
        <input
          aria-label="program name"
          autoFocus
          value={nameBuf}
          onChange={(e) => setNameBuf(e.target.value)}
          onBlur={commitRename}
          onKeyDown={(e) => e.key === 'Enter' && commitRename()}
          className="rounded-card border border-stroke bg-input p-2 text-[30px] font-extrabold text-ink"
        />
      ) : (
        <button
          onClick={() => { setNameBuf(program.name); setRenaming(true); }}
          className="flex items-center gap-2 text-left"
        >
          <span className="text-[30px] font-extrabold tracking-[-0.02em] text-ink">{program.name}</span>
          <span className="text-[15px] text-ink-faint">✎</span>
        </button>
      )}

      <p className="text-[13px] text-ink-dim">
        {effortLabel(program.effort)} effort · {program.daysPerWeek} days · {program.muscles.length} muscle groups
      </p>

      {[...program.days]
        .sort((a, b) => a.index - b.index)
        .map((day) => {
          const sets = day.lifts.reduce((s, l) => s + l.targetSets, 0);
          return (
            <Link
              key={day.index}
              to={`/program/${id}/day/${day.index}`}
              className="flex items-center gap-4 rounded-card border border-stroke bg-card p-4"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-input font-mono text-[17px] font-extrabold text-ink">
                {day.index + 1}
              </span>
              <div className="flex-1">
                <p className="text-[15px] font-bold text-ink">{dayFocus(day.lifts) || 'Rest / empty'}</p>
                <p className="text-[12px] text-ink-dim">{day.lifts.length} lifts · {sets} sets</p>
              </div>
            </Link>
          );
        })}

      {confirmDelete ? (
        <div className="rounded-card border border-red-500/40 p-4">
          <p className="text-[13px] text-ink">Delete "{program.name}"? Logged workouts are kept.</p>
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => deleteProgram(user.uid, id).then(() => navigate('/program')).catch((e) => console.error(e))}
              className="rounded-btn bg-red-500/90 px-4 py-2 text-[13px] font-bold text-white"
            >
              Delete
            </button>
            <button onClick={() => setConfirmDelete(false)} className="px-4 py-2 text-[13px] font-bold text-ink-dim">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setConfirmDelete(true)}
          className="mt-2 rounded-btn border border-red-500/40 py-3 text-[14px] font-bold text-red-400"
        >
          Delete program
        </button>
      )}
    </main>
  );
}
