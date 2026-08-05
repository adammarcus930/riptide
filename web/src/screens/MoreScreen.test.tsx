import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { test, expect, vi, beforeEach } from 'vitest';

const setRestAlertSec = vi.fn();
vi.mock('../auth/useAuth', () => ({ useAuth: () => ({ user: { uid: 'alice' }, signOut: vi.fn() }) }));
vi.mock('../data/profile', () => ({
  setRestAlertSec: (...args: unknown[]) => setRestAlertSec(...args),
  useProfile: () => ({ profile: { restAlertSec: 180 }, loading: false }),
}));

import { MoreScreen } from './MoreScreen';

beforeEach(() => setRestAlertSec.mockClear());

test('shows the current rest value and increments it', async () => {
  render(<MoreScreen />);
  expect(screen.getByText('180 seconds')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'increase' }));
  expect(setRestAlertSec).toHaveBeenCalledWith('alice', 195);
});

test('decrements the rest value', async () => {
  render(<MoreScreen />);
  await userEvent.click(screen.getByRole('button', { name: 'decrease' }));
  expect(setRestAlertSec).toHaveBeenCalledWith('alice', 165);
});
