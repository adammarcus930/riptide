import { render, screen } from '@testing-library/react';
import { test, expect, vi } from 'vitest';

const useHistory = vi.fn();
vi.mock('../auth/useAuth', () => ({ useAuth: () => ({ user: { uid: 'u1' } }) }));
vi.mock('../data/workouts', () => ({ useHistory: () => useHistory() }));

import { HistoryScreen } from './HistoryScreen';

test('empty state', () => {
  useHistory.mockReturnValue({ sessions: [], loading: false });
  render(<HistoryScreen />);
  expect(screen.getByText(/Nothing logged yet/)).toBeInTheDocument();
});

test('renders a session row with set count and program label', () => {
  useHistory.mockReturnValue({
    loading: false,
    sessions: [{ id: 's1', startedAt: Date.now(), setCount: 12, programName: '4-Day Optimal', dayIndex: 2, finishedAt: Date.now() }],
  });
  render(<HistoryScreen />);
  expect(screen.getByText('12 sets')).toBeInTheDocument();
  expect(screen.getByText(/4-Day Optimal · Day 3/)).toBeInTheDocument();
});
