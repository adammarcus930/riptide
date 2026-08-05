import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { test, expect, vi } from 'vitest';
import { AccentButton } from './AccentButton';

test('renders label and fires onClick', async () => {
  const onClick = vi.fn();
  render(<AccentButton onClick={onClick}>Go</AccentButton>);
  await userEvent.click(screen.getByRole('button', { name: 'Go' }));
  expect(onClick).toHaveBeenCalledOnce();
});
