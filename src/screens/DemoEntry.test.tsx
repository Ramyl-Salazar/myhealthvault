import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DemoEntry } from './DemoEntry';
import { screens } from '../copy';

const { startDemo } = vi.hoisted(() => ({ startDemo: vi.fn() }));
vi.mock('../data/session', () => ({ startDemo }));

beforeEach(() => { cleanup(); vi.resetAllMocks(); });

function renderEntry() {
  render(<MemoryRouter initialEntries={['/']}><Routes><Route path="/" element={<DemoEntry />} /><Route path="/home" element={<div>{screens.home}</div>} /></Routes></MemoryRouter>);
}

describe('DemoEntry', () => {
  it('starts the demo once and opens home', async () => {
    startDemo.mockResolvedValue(undefined);
    renderEntry();
    await userEvent.click(screen.getByRole('button', { name: 'Try the demo' }));
    expect(await screen.findByText(screens.home)).not.toBeNull();
    expect(startDemo).toHaveBeenCalledTimes(1);
  });

  it('shows an error and retries on the entry route', async () => {
    startDemo.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(undefined);
    renderEntry();
    await userEvent.click(screen.getByRole('button', { name: 'Try the demo' }));
    expect(await screen.findByRole('button', { name: 'Try again' })).not.toBeNull();
    expect(screen.queryByText(screens.home)).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText(screens.home)).not.toBeNull();
    expect(startDemo).toHaveBeenCalledTimes(2);
  });
});
