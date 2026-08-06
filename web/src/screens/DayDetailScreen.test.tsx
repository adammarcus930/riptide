import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { test, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

const useProgram = vi.fn();
const updateProgramDays = vi.fn().mockResolvedValue(undefined);
vi.mock('../auth/useAuth', () => ({ useAuth: () => ({ user: { uid: 'u1' } }) }));
vi.mock('../data/programs', () => ({
  useProgram: (...a: unknown[]) => useProgram(...a),
  updateProgramDays: (...a: unknown[]) => updateProgramDays(...a),
}));

import { DayDetailScreen } from './DayDetailScreen';

const program = {
  id: 'p1', name: 'X', effort: 'optimal', muscles: ['chest'], isActive: true, daysPerWeek: 1,
  days: [{
    index: 0, completedInCycle: false, lifts: [
      { order: 0, muscle: 'chest', exerciseId: 'bench-press', exerciseName: 'Barbell Bench Press', repRange: '5-8', targetSets: 3 },
      { order: 1, muscle: 'chest', exerciseId: 'incline-db-press', exerciseName: 'Incline Dumbbell Press', repRange: '8-12', targetSets: 3 },
    ],
  }],
};

function renderAt() {
  useProgram.mockReturnValue({ program, loading: false });
  return render(
    <MemoryRouter initialEntries={['/program/p1/day/0']}>
      <Routes><Route path="/program/:id/day/:dayIndex" element={<DayDetailScreen />} /></Routes>
    </MemoryRouter>,
  );
}
beforeEach(() => updateProgramDays.mockClear());

test('view mode shows the day focus and lifts', () => {
  renderAt();
  expect(screen.getByRole('heading', { name: 'Chest' })).toBeInTheDocument();
  expect(screen.getByText('Barbell Bench Press')).toBeInTheDocument();
});

test('increasing sets saves a reindexed days array', async () => {
  renderAt();
  await userEvent.click(screen.getByRole('button', { name: 'Edit' }));
  await userEvent.click(screen.getByLabelText('sets-plus-0'));
  expect(updateProgramDays).toHaveBeenCalledTimes(1);
  const [uid, pid, days] = updateProgramDays.mock.calls[0];
  expect(uid).toBe('u1');
  expect(pid).toBe('p1');
  expect(days[0].lifts[0].targetSets).toBe(4);
  expect(days[0].lifts.map((l: { order: number }) => l.order)).toEqual([0, 1]);
});

test('deleting a lift removes it and re-indexes order', async () => {
  renderAt();
  await userEvent.click(screen.getByRole('button', { name: 'Edit' }));
  await userEvent.click(screen.getByLabelText('delete-0'));
  const days = updateProgramDays.mock.calls[0][2];
  expect(days[0].lifts).toHaveLength(1);
  expect(days[0].lifts[0].exerciseName).toBe('Incline Dumbbell Press');
  expect(days[0].lifts[0].order).toBe(0);
});
