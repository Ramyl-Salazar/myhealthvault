import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { BottomNav } from './BottomNav';

describe('BottomNav', () => {
  it('marks the current section active', () => {
    render(<MemoryRouter initialEntries={['/share/new']}><BottomNav /></MemoryRouter>);
    expect(screen.getByRole('link', { name: 'Share' }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('link', { name: 'Home' }).hasAttribute('aria-current')).toBe(false);
  });
});
