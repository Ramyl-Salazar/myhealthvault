export const sexOptions = [
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
  { value: 'another_description', label: 'Another description' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
] as const;

export function sexLabel(value: string): string {
  return sexOptions.find(option => option.value === value)?.label ?? value;
}
