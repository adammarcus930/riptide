import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { test, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

const createProgram = vi.fn().mockResolvedValue('new-id');
const navigate = vi.fn();
vi.mock('../auth/useAuth', () => ({ useAuth: () => ({ user: { uid: 'u1' } }) }));
vi.mock('../data/programs', () => ({ createProgram: (...a: unknown[]) => createProgram(...a) }));
vi.mock('react-router-dom', async (orig) => ({
  ...(await orig<typeof import('react-router-dom')>()),
  useNavigate: () => navigate,
}));

import { WizardScreen } from './WizardScreen';
import { ExerciseBank } from '../core';

beforeEach(() => { createProgram.mockClear(); navigate.mockClear(); });

test('walks the steps and builds a named, active program', async () => {
  const u = userEvent.setup();
  render(<MemoryRouter><WizardScreen /></MemoryRouter>);

  // days: pick 4
  await u.click(screen.getByRole('button', { name: '4' }));
  await u.click(screen.getByRole('button', { name: 'Continue' }));
  // muscles: pick Chest
  expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
  expect(within(screen.getByRole('group', { name: 'Chest' })).getByRole('radio', { name: 'Skip' })).toBeChecked();
  await u.click(within(screen.getByRole('group', { name: 'Chest' })).getByRole('radio', { name: 'Optimal' }));
  await u.click(screen.getByRole('button', { name: 'Continue' }));
  // exercises for chest: pick the first
  await u.click(screen.getByText('Barbell Bench Press'));
  await u.click(screen.getByRole('button', { name: 'Continue' }));
  // name step: default filled
  const nameField = screen.getByLabelText('program name') as HTMLInputElement;
  expect(nameField.value).toBe('4-Day Optimal');
  await u.click(screen.getByRole('button', { name: 'Build my program' }));

  expect(createProgram).toHaveBeenCalledTimes(1);
  const [uid, input] = createProgram.mock.calls[0];
  expect(uid).toBe('u1');
  expect(input.name).toBe('4-Day Optimal');
  expect(input.muscleEfforts).toEqual({ chest: 'optimal' });
  expect(input.days).toBe(4);
  expect(input.selections.get('chest')).toHaveLength(1);
  expect(navigate).toHaveBeenCalledWith('/program/new-id', { replace: true });
});


test('mixed levels persist through back navigation and show capacity warning before building', async () => {
  const u = userEvent.setup();
  render(<MemoryRouter><WizardScreen /></MemoryRouter>);
  await u.click(screen.getByRole('button', { name: '2' }));
  await u.click(screen.getByRole('button', { name: 'Continue' }));
  await u.click(within(screen.getByRole('group', { name: 'Chest' })).getByRole('radio', { name: 'Maximal' }));
  await u.click(within(screen.getByRole('group', { name: 'Quads' })).getByRole('radio', { name: 'Minimal' }));
  await u.click(screen.getByRole('button', { name: 'Continue' }));
  await u.click(screen.getByText(ExerciseBank.exercisesFor('quads')[0].name));
  await u.click(screen.getByRole('button', { name: 'back' }));
  expect(within(screen.getByRole('group', { name: 'Chest' })).getByRole('radio', { name: 'Maximal' })).toBeChecked();
  await u.click(screen.getByRole('button', { name: 'Continue' }));
  await u.click(screen.getByRole('button', { name: 'Continue' }));
  // Chest follows quads in the existing display order.
  await u.click(screen.getByText('Barbell Bench Press'));
  await u.click(screen.getByRole('button', { name: 'Continue' }));
  expect(screen.getByLabelText('program name')).toHaveValue('2-Day Custom');
  expect(screen.getByRole('status')).toHaveTextContent('Chest: 8 of 17 target direct sets');
  await u.click(screen.getByRole('button', { name: 'Build my program' }));
  expect(createProgram.mock.calls[0][1].muscleEfforts).toEqual({ chest: 'maximal', quads: 'minimal' });
});

test('skipping a previously selected muscle removes its exercise step and saved selection', async () => {
  const u = userEvent.setup();
  render(<MemoryRouter><WizardScreen /></MemoryRouter>);
  await u.click(screen.getByRole('button', { name: '4' }));
  await u.click(screen.getByRole('button', { name: 'Continue' }));
  await u.click(within(screen.getByRole('group', { name: 'Chest' })).getByRole('radio', { name: 'Optimal' }));
  await u.click(screen.getByRole('button', { name: 'Continue' }));
  await u.click(screen.getByText('Barbell Bench Press'));
  await u.click(screen.getByRole('button', { name: 'back' }));
  await u.click(within(screen.getByRole('group', { name: 'Chest' })).getByRole('radio', { name: 'Skip' }));
  expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
  await u.click(within(screen.getByRole('group', { name: 'Quads' })).getByRole('radio', { name: 'Minimal' }));
  await u.click(screen.getByRole('button', { name: 'Continue' }));
  expect(screen.getByRole('heading', { name: 'Quads' })).toBeInTheDocument();
  await u.click(screen.getByText(ExerciseBank.exercisesFor('quads')[0].name));
  await u.click(screen.getByRole('button', { name: 'Continue' }));
  await u.click(screen.getByRole('button', { name: 'Build my program' }));
  const input = createProgram.mock.calls[0][1];
  expect(input.muscleEfforts).toEqual({ quads: 'minimal' });
  expect(input.selections.has('chest')).toBe(false);
});


test('suggested name follows changed days while a user-written name is preserved', async () => {
  const u = userEvent.setup();
  render(<MemoryRouter><WizardScreen /></MemoryRouter>);
  await u.click(screen.getByRole('button', { name: '2' }));
  await u.click(screen.getByRole('button', { name: 'Continue' }));
  await u.click(within(screen.getByRole('group', { name: 'Chest' })).getByRole('radio', { name: 'Maximal' }));
  await u.click(screen.getByRole('button', { name: 'Continue' }));
  await u.click(screen.getByText('Barbell Bench Press'));
  await u.click(screen.getByRole('button', { name: 'Continue' }));
  expect(screen.getByLabelText('program name')).toHaveValue('2-Day Maximal');
  async function changeDays(days: string) {
    for (let i = 0; i < 3; i++) await u.click(screen.getByRole('button', { name: 'back' }));
    await u.click(screen.getByRole('button', { name: days }));
    for (let i = 0; i < 3; i++) await u.click(screen.getByRole('button', { name: 'Continue' }));
  }
  await changeDays('5');
  expect(screen.getByLabelText('program name')).toHaveValue('5-Day Maximal');
  await u.clear(screen.getByLabelText('program name'));
  await u.type(screen.getByLabelText('program name'), 'My plan');
  await changeDays('6');
  expect(screen.getByLabelText('program name')).toHaveValue('My plan');
});
