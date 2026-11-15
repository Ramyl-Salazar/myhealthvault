import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TrustBadge } from './TrustBadge';

describe('TrustBadge', () => {
  it.each([
    ['patient_entered', 'Entered by patient'],
    ['document_supported', 'Supported by a document'],
    ['clinician_verified', 'Verified by a clinician'],
  ] as const)('shows the %s label in full and compact forms', (level, label) => {
    const { rerender } = render(<TrustBadge level={level} />);
    expect(screen.getByText(label)).not.toBeNull();
    rerender(<TrustBadge level={level} compact />);
    expect(screen.getByLabelText(label)).not.toBeNull();
  });
});
