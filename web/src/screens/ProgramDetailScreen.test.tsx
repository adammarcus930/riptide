import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { test, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

const useProgram = vi.fn();
const setActiveProgram = vi.fn().mockResolvedValue(undefined);
const renameProgram = vi.fn().mockResolvedValue(undefined);
const deleteProgram = vi.fn().mockResolvedValue(undefined);
vi.mock('../auth/useAuth', () => ({ useAuth: () => ({ user: { uid: 'u1' } }) }));
vi.mock('../data/programs', () => ({
  useProgram: (...a: unknown[]) => useProgram(...a),
  setActiveProgram: (...a: unknown[]) => setActiveProgram(...a),
  renameProgram: (...a: unknown[]) => renameProgram(...a),
  deleteProgram: (...a: unknown[]) => deleteProgram(...a),
}));

import { ProgramDetailScreen } from './ProgramDetailScreen';

const program = {
  id: 'p1', name: '4-Day Optimal', effort: 'optimal', muscles: ['chest'], isActive: false, daysPerWeek: 4,
  days: [{ index: 0, completedInCycle: false, lifts: [{ order: 0, muscle: 'chest', exerciseId: 'bench', exerciseName: 'Bench', repRange: '5-8', targetSets: 3 }] }],
};

function renderAt() {
  return render(
    <MemoryRouter initialEntries={['/program/p1']}>
      <Routes><Route path="/program/:id" element={<ProgramDetailScreen />} /></Routes>
    </MemoryRouter>,
  );
}
beforeEach(() => { setActiveProgram.mockClear(); renameProgram.mockClear(); deleteProgram.mockClear(); });

test('make active calls setActiveProgram for an inactive program', async () => {
  useProgram.mockReturnValue({ program, loading: false });
  renderAt();
  await userEvent.click(screen.getByRole('button', { name: 'Make active' }));
  expect(setActiveProgram).toHaveBeenCalledWith('u1', 'p1');
});

test('rename commits a trimmed non-empty name', async () => {
  useProgram.mockReturnValue({ program, loading: false });
  renderAt();
  await userEvent.click(screen.getByText('4-Day Optimal'));
  const field = screen.getByLabelText('program name');
  await userEvent.clear(field);
  await userEvent.type(field, 'Push Pull{Enter}');
  expect(renameProgram).toHaveBeenCalledWith('u1', 'p1', 'Push Pull');
});

test('delete asks for confirmation then deletes', async () => {
  useProgram.mockReturnValue({ program, loading: false });
  renderAt();
  await userEvent.click(screen.getByRole('button', { name: 'Delete program' }));
  await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
  expect(deleteProgram).toHaveBeenCalledWith('u1', 'p1');
});
