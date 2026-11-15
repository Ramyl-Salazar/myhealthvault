import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';

const { getSession } = vi.hoisted(() => ({ getSession: vi.fn() }));
vi.mock('./data/supabase', () => ({ supabase: { auth: { getSession } } }));

function Location() {
  const location = useLocation();
  return <output data-testid="path">{location.pathname}</output>;
}

beforeEach(() => vi.resetAllMocks());

describe('protected routes', () => {
  it('redirects to entry when there is no session', async () => {
    getSession.mockResolvedValue({ data: { session: null }, error: null });
    render(<MemoryRouter initialEntries={['/home']}><App /><Location /></MemoryRouter>);
    await waitFor(() => expect(screen.getByTestId('path').textContent).toBe('/'));
    expect(await screen.findByRole('button', { name: 'Try the demo' })).not.toBeNull();
  });
});
