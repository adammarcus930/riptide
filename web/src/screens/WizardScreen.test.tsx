import { render, screen } from '@testing-library/react';
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

beforeEach(() => { createProgram.mockClear(); navigate.mockClear(); });

test('walks the steps and builds a named, active program', async () => {
  const u = userEvent.setup();
  render(<MemoryRouter><WizardScreen /></MemoryRouter>);

  // effort defaults to optimal → Continue
  await u.click(screen.getByRole('button', { name: 'Continue' }));
  // days: pick 4
  await u.click(screen.getByRole('button', { name: '4' }));
  await u.click(screen.getByRole('button', { name: 'Continue' }));
  // muscles: pick Chest
  await u.click(screen.getByRole('button', { name: 'Chest' }));
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
  expect(input.effort).toBe('optimal');
  expect(input.days).toBe(4);
  expect(input.selections.get('chest')).toHaveLength(1);
  expect(navigate).toHaveBeenCalledWith('/program/new-id', { replace: true });
});
