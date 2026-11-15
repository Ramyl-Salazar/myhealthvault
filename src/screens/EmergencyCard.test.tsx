import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import { emergency } from '../copy/emergency';
import { EmergencyCard } from './EmergencyCard';

beforeEach(() => { cleanup(); localStorage.clear(); });

it('shows an empty offline card without a network request', () => {
  const fetch = vi.fn();
  vi.stubGlobal('fetch', fetch);
  render(<MemoryRouter><EmergencyCard /></MemoryRouter>);
  expect(screen.getByText(emergency.empty)).not.toBeNull();
  expect(fetch).not.toHaveBeenCalled();
  vi.unstubAllGlobals();
});
