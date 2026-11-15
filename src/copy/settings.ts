export const settings = {
  title: 'Settings', profile: 'Profile', name: 'Name', birthDate: 'Birth date', sex: 'Sex', bloodType: 'Blood type', contacts: 'Emergency contacts',
  day: 'Day', month: 'Month', year: 'Year', invalidBirthDate: 'Enter a real birth date.', months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  sexNone: 'Not specified',
  contact: (number: number) => `Contact ${number}`,
  contactName: 'Contact name', relation: 'Relationship', phone: 'Phone number', addContact: 'Add contact', removeContact: 'Remove contact', save: 'Save profile', saved: 'Profile saved.',
  emergency: 'Emergency card', emergencyToggle: 'Save an emergency card on this device', pin: 'Device PIN',
  data: 'Your data', download: 'Download my data', print: 'Print a summary', reset: 'Reset demo data', delete: 'Delete everything',
  deletePrompt: 'Type delete to confirm', deleteWord: 'delete', deleteNote: 'This removes your demo records, documents and share history.',
  brandNote: 'The brand-name list used for duplicate checks is a short demo list.',
  resetConfirm: 'This replaces your records with the demo data. Continue?', resetAction: 'Reset', cancel: 'Cancel',
  error: 'Could not complete this action. Try again.', resetDone: 'Demo data reset.', exportName: 'myhealthvault-data.json',
};
