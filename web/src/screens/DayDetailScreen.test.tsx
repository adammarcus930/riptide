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

const completeDay = vi.fn().mockResolvedValue(undefined);
const useOpenSession = vi.fn();
const useSessionSets = vi.fn();
vi.mock('../data/workouts', () => ({
  useOpenSession: (...a: unknown[]) => useOpenSession(...a),
  useSessionSets: (...a: unknown[]) => useSessionSets(...a),
  completeDay: (...a: unknown[]) => completeDay(...a),
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
beforeEach(() => {
  updateProgramDays.mockClear();
  completeDay.mockClear();
  useOpenSession.mockReturnValue({ session: null });
  useSessionSets.mockReturnValue({ sets: [] });
});

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

test('moving a lift down swaps order and re-indexes', async () => {
  renderAt();
  await userEvent.click(screen.getByRole('button', { name: 'Edit' }));
  await userEvent.click(screen.getByLabelText('down-0'));
  expect(updateProgramDays).toHaveBeenCalledTimes(1);
  const days = updateProgramDays.mock.calls[0][2];
  expect(days[0].lifts).toHaveLength(2);
  expect(days[0].lifts[0].exerciseName).toBe('Incline Dumbbell Press');
  expect(days[0].lifts[0].order).toBe(0);
  expect(days[0].lifts[1].exerciseName).toBe('Barbell Bench Press');
  expect(days[0].lifts[1].order).toBe(1);
});

test('adding a lift appends it with the next order', async () => {
  renderAt();
  await userEvent.click(screen.getByRole('button', { name: 'Edit' }));
  await userEvent.click(screen.getByRole('button', { name: '+ Add a lift' }));
  await userEvent.click(screen.getByRole('button', { name: /Cable Fly/ }));
  expect(updateProgramDays).toHaveBeenCalledTimes(1);
  const days = updateProgramDays.mock.calls[0][2];
  expect(days[0].lifts).toHaveLength(3);
  expect(days[0].lifts[2].exerciseName).toBe('Cable Fly');
  expect(days[0].lifts[2].order).toBe(2);
});

test('live mode shows a checkmark for a logged lift and links to lift detail', () => {
  useOpenSession.mockReturnValue({ session: { id: 's1', dayIndex: 0 } });
  useSessionSets.mockReturnValue({ sets: [{ exerciseId: 'bench-press', setIndex: 0 }] });
  renderAt();
  expect(screen.getByRole('link', { name: /Barbell Bench Press/ })).toHaveAttribute('href', '/program/p1/day/0/lift/0');
  expect(screen.getByRole('img', { name: 'done' })).toBeInTheDocument();
});

test('survives the loading -> loaded transition (no hook-order crash)', () => {
  useProgram.mockReturnValueOnce({ program: null, loading: true });
  useProgram.mockReturnValue({ program, loading: false });
  useOpenSession.mockReturnValue({ session: null });
  useSessionSets.mockReturnValue({ sets: [] });
  const { rerender } = render(
    <MemoryRouter initialEntries={['/program/p1/day/0']}>
      <Routes><Route path="/program/:id/day/:dayIndex" element={<DayDetailScreen />} /></Routes>
    </MemoryRouter>,
  );
  rerender(
    <MemoryRouter initialEntries={['/program/p1/day/0']}>
      <Routes><Route path="/program/:id/day/:dayIndex" element={<DayDetailScreen />} /></Routes>
    </MemoryRouter>,
  );
  expect(screen.getByText('Barbell Bench Press')).toBeInTheDocument();
});

test('Complete day calls completeDay', async () => {
  useOpenSession.mockReturnValue({ session: null });
  useSessionSets.mockReturnValue({ sets: [] });
  renderAt();
  await userEvent.click(screen.getByRole('button', { name: 'Complete day' }));
  expect(completeDay).toHaveBeenCalledWith('u1', 'p1', 0);
});
