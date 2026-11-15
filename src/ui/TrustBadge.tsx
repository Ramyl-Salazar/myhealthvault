import { Check, FileText, Pencil } from 'lucide-react';
import type { TrustLevel } from '../domain/types';
import { trust } from '../copy';

const icons = { patient_entered: Pencil, document_supported: FileText, clinician_verified: Check };
const styles = {
  patient_entered: 'border-dashed border-patient bg-patient-soft text-patient',
  document_supported: 'border-primary bg-primary-soft text-primary',
  clinician_verified: 'border-verified bg-verified text-on-verified',
};

export function TrustBadge({ level, compact = false }: { level: TrustLevel; compact?: boolean }) {
  const Icon = icons[level];
  const label = trust[level];
  return <span aria-label={compact ? label : undefined} className={`inline-flex items-center gap-1 rounded-pill border text-xs font-medium leading-none whitespace-nowrap ${compact ? 'p-1' : 'px-2 py-1'} ${styles[level]}`}>
    <Icon size={14} strokeWidth={1.9} aria-hidden="true" />
    {!compact && label}
  </span>;
}
