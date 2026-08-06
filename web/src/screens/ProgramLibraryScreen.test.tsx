import { render, screen } from '@testing-library/react';
import { test, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../auth/useAuth', () => ({ useAuth: () => ({ user: { uid: 'u1' } }) }));
const usePrograms = vi.fn();
vi.mock('../data/programs', () => ({ usePrograms: (uid: string) => usePrograms(uid) }));

import { ProgramLibraryScreen } from './ProgramLibraryScreen';

function renderScreen() {
  return render(<MemoryRouter><ProgramLibraryScreen /></MemoryRouter>);
}

test('shows the empty state with a build link when there are no programs', () => {
  usePrograms.mockReturnValue({ programs: [], loading: false });
  renderScreen();
  expect(screen.getByText('No programs yet.')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Build a program' })).toHaveAttribute('href', '/wizard');
});

test('lists programs and marks the active one', () => {
  usePrograms.mockReturnValue({
    loading: false,
    programs: [
      { id: 'a', name: '4-Day Optimal', isActive: true, daysPerWeek: 4, days: [{}, {}, {}, {}] },
      { id: 'b', name: 'Old Plan', isActive: false, daysPerWeek: 3, days: [{}, {}, {}] },
    ],
  });
  renderScreen();
  expect(screen.getByText('4-Day Optimal')).toBeInTheDocument();
  expect(screen.getByText('ACTIVE')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /Old Plan/ })).toHaveAttribute('href', '/program/b');
});
