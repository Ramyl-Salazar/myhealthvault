import { Camera, FlaskConical, HeartPulse, Pill, Scissors, Stethoscope, Syringe, TriangleAlert } from 'lucide-react';
import type { RecordType } from '../domain/types';

const kinds = {
  medication: { icon: Pill, style: 'bg-cat-medicine-soft text-cat-medicine' },
  diagnosis: { icon: HeartPulse, style: 'bg-cat-condition-soft text-cat-condition' },
  lab_result: { icon: FlaskConical, style: 'bg-cat-result-soft text-cat-result' },
  visit: { icon: Stethoscope, style: 'bg-cat-visit-soft text-cat-visit' },
  immunization: { icon: Syringe, style: 'bg-cat-vaccine-soft text-cat-vaccine' },
  procedure: { icon: Scissors, style: 'bg-cat-procedure-soft text-cat-procedure' },
  allergy: { icon: TriangleAlert, style: 'bg-cat-allergy-soft text-cat-allergy' },
  primary: { icon: Camera, style: 'bg-primary-soft text-primary' },
};

export function IconTile({ type, size = 'md' }: { type: RecordType | 'allergy' | 'primary'; size?: 'sm' | 'md' }) {
  const { icon: Icon, style } = kinds[type];
  return <span aria-hidden="true" className={`grid shrink-0 place-items-center ${size === 'sm' ? 'size-8 rounded-sm' : 'size-10 rounded-md'} ${style}`}>
    <Icon size={size === 'sm' ? 18 : 20} strokeWidth={1.9} />
  </span>;
}
