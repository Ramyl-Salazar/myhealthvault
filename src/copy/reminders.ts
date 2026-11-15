export const reminders = {
  dismiss: 'Dismiss this reminder',
  followUp: (date: string, provider: string | null) => provider ? `Follow-up due ${date} at ${provider}` : `Follow-up due ${date}`,
  ending: (title: string, date: string) => `${title} runs out on ${date}`,
  duplicate: (titles: string, generic: string) => `Possible duplicate: ${titles} may be the same medicine (${generic})`,
  error: 'Could not dismiss the reminder. Check your connection and try again.',
} as const;
