import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { test, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

const toggleSet = vi.fn().mockResolvedValue(undefined);
const lastSets = vi.fn().mockResolvedValue([{ setIndex: 0, weight: 100, reps: 5, loggedAt: 1754500000000 }]);
const useOpenSession = vi.fn(() => ({ session: { id: 's1', dayIndex: 0 }, loading: false }));
const useSessionSets = vi.fn(() => ({ sets: [], loading: false }));
vi.mock('../auth/useAuth', () => ({ useAuth: () => ({ user: { uid: 'u1' } }) }));
vi.mock('../data/profile', () => ({ useProfile: () => ({ profile: { restAlertSec: 180 } }) }));
vi.mock('../data/programs', () => ({
  useProgram: () => ({
    loading: false,
    program: { id: 'p1', name: 'X', days: [{ index: 0, lifts: [
      { order: 0, muscle: 'chest', exerciseId: 'bench-press', exerciseName: 'Bench', repRange: '5-8', targetSets: 2 },
    ] }] },
  }),
}));
vi.mock('../data/workouts', () => ({
  useOpenSession: () => useOpenSession(),
  useSessionSets: () => useSessionSets(),
  toggleSet: (...a: unknown[]) => toggleSet(...a),
  lastSets: (...a: unknown[]) => lastSets(...a),
  mergedBySetIndex: (cur: { setIndex: number; weight: number; reps: number }[], prev: { setIndex: number; weight: number; reps: number }[]) => {
    const m = new Map(); for (const s of prev) m.set(s.setIndex, { weight: s.weight, reps: s.reps }); for (const s of cur) m.set(s.setIndex, { weight: s.weight, reps: s.reps }); return m;
  },
}));

import { LiftDetailScreen } from './LiftDetailScreen';

function renderAt() {
  return render(
    <MemoryRouter initialEntries={['/program/p1/day/0/lift/0']}>
      <Routes><Route path="/program/:id/day/:dayIndex/lift/:order" element={<LiftDetailScreen />} /></Routes>
    </MemoryRouter>,
  );
}
beforeEach(() => toggleSet.mockClear());

test('prefills weight/reps from last time and shows the last-time line', async () => {
  renderAt();
  await waitFor(() => expect((screen.getByLabelText('lb-0') as HTMLInputElement).value).toBe('100'));
  expect((screen.getByLabelText('5-8-0') as HTMLInputElement).value).toBe('5');
  expect(screen.getByText('Last time')).toBeInTheDocument();
  expect(screen.getByText(/100×5/)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Done with this lift' })).toHaveAttribute('href', '/program/p1/day/0');
});

test('toggling DONE logs the set with entered values', async () => {
  renderAt();
  await waitFor(() => expect((screen.getByLabelText('lb-0') as HTMLInputElement).value).toBe('100'));
  await userEvent.click(screen.getByLabelText('done-0'));
  expect(toggleSet).toHaveBeenCalledWith('u1', expect.objectContaining({
    programId: 'p1', dayIndex: 0, exerciseId: 'bench-press', setIndex: 0, weight: 100, reps: 5,
  }));
});
