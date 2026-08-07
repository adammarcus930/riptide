import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { test, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

const useActiveProgram = vi.fn();
const startNextCycle = vi.fn().mockResolvedValue(undefined);
vi.mock('../auth/useAuth', () => ({ useAuth: () => ({ user: { uid: 'u1' } }) }));
vi.mock('../data/programs', () => ({ useActiveProgram: (uid: string) => useActiveProgram(uid) }));
vi.mock('../data/workouts', () => ({ startNextCycle: (...a: unknown[]) => startNextCycle(...a) }));

import { TodayScreen } from './TodayScreen';

const lift = { order: 0, muscle: 'chest', exerciseId: 'bench-press', exerciseName: 'Bench', repRange: '5-8', targetSets: 3 };
const prog = (over: object) => ({ id: 'p1', name: 'X', effort: 'optimal', muscles: ['chest'], isActive: true, daysPerWeek: 2, createdAt: 0, ...over });
const render1 = () => render(<MemoryRouter><TodayScreen /></MemoryRouter>);
beforeEach(() => startNextCycle.mockClear());

test('empty state links to the wizard when no active program', () => {
  useActiveProgram.mockReturnValue({ program: null, loading: false });
  render1();
  expect(screen.getByRole('link', { name: 'Build my program' })).toHaveAttribute('href', '/wizard');
});

test('defaults to the next uncompleted day', () => {
  useActiveProgram.mockReturnValue({ loading: false, program: prog({ days: [
    { index: 0, completedInCycle: true, lifts: [lift] },
    { index: 1, completedInCycle: false, lifts: [lift] },
  ] }) });
  render1();
  expect(screen.getByText('DAY 2 OF 2 · NEXT')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Start day 2' })).toHaveAttribute('href', '/program/p1/day/1');
});

test('tapping a cycle day switches the previewed day and its start link', async () => {
  useActiveProgram.mockReturnValue({ loading: false, program: prog({ days: [
    { index: 0, completedInCycle: false, lifts: [lift] },
    { index: 1, completedInCycle: false, lifts: [lift] },
  ] }) });
  render1();
  expect(screen.getByRole('link', { name: 'Start day 1' })).toHaveAttribute('href', '/program/p1/day/0');
  await userEvent.click(screen.getByRole('button', { name: 'Day 2 TO GO' }));
  expect(screen.getByRole('link', { name: 'Start day 2' })).toHaveAttribute('href', '/program/p1/day/1');
});

test('week complete shows Start next cycle', async () => {
  useActiveProgram.mockReturnValue({ loading: false, program: prog({ daysPerWeek: 1, days: [
    { index: 0, completedInCycle: true, lifts: [lift] },
  ] }) });
  render1();
  await userEvent.click(screen.getByRole('button', { name: 'Start next cycle' }));
  expect(startNextCycle).toHaveBeenCalledWith('u1', 'p1');
});
