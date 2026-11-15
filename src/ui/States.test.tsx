import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { common } from '../copy';
import { EmptyState } from './EmptyState';
import { ErrorState } from './ErrorState';
import { Skeleton } from './Skeleton';

describe('shared states', () => {
  it('shows the empty message', () => {
    render(<EmptyState />);
    expect(screen.getByRole('status').textContent).toBe(common.placeholder);
  });

  it('retries from the error state', async () => {
    const retry = vi.fn();
    render(<ErrorState onRetry={retry} />);
    await userEvent.click(screen.getByRole('button', { name: common.retry }));
    expect(retry).toHaveBeenCalledOnce();
  });

  it('names the loading state', () => {
    render(<Skeleton />);
    expect(screen.getByRole('status', { name: common.loading })).not.toBeNull();
  });
});
