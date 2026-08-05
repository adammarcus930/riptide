import { render, screen } from '@testing-library/react';
import { test, expect } from 'vitest';
import App from './App';

test('renders the foundation heading', () => {
  render(<App />);
  expect(screen.getByRole('heading', { name: 'Foundation' })).toBeInTheDocument();
});
