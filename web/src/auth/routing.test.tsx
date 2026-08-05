import { render, screen } from '@testing-library/react';
import { test, expect } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuthContext, type AuthState } from './AuthContext';
import { RequireAuth } from './RequireAuth';
import { LoginScreen } from './LoginScreen';

function renderAt(path: string, value: AuthState) {
  return render(
    <AuthContext.Provider value={value}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/login" element={<LoginScreen />} />
          <Route element={<RequireAuth />}>
            <Route path="/" element={<div>PROTECTED</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}
const base = { loading: false, signIn: () => {}, signOut: () => {} };

test('signed-out user is redirected to the login screen', () => {
  renderAt('/', { ...base, user: null } as AuthState);
  expect(screen.getByRole('button', { name: /sign in with google/i })).toBeInTheDocument();
  expect(screen.queryByText('PROTECTED')).not.toBeInTheDocument();
});

test('signed-in user sees the protected route', () => {
  renderAt('/', { ...base, user: { uid: 'alice' } as never } as AuthState);
  expect(screen.getByText('PROTECTED')).toBeInTheDocument();
});
