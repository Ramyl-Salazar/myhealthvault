export const pin = {
  title: 'Enter PIN', prompt: 'Enter your 4-digit PIN to open MyHealthVault.', input: '4-digit PIN', unlock: 'Open app',
  incorrect: 'Incorrect PIN. Try again.', wait: (seconds: number) => `Try again in ${seconds} seconds.`,
  setup: 'Set PIN', change: 'Change PIN', confirm: 'Confirm PIN', save: 'Save PIN', remove: 'Remove PIN',
  mismatch: 'PINs do not match.', invalid: 'Enter four digits.', unavailable: 'PIN could not be saved on this device.', saved: 'PIN saved.',
  consent: 'Anyone holding this phone can open the emergency card without your PIN.',
};
