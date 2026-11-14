// A short demo list of brand names sold in the Philippines, mapped to their
// generic names. It is not a clinical reference and it is not complete.

const BRAND_TO_GENERIC: Record<string, string> = {
  biogesic: 'paracetamol',
  tempra: 'paracetamol',
  calpol: 'paracetamol',
  glucophage: 'metformin',
  lifezar: 'losartan',
  cozaar: 'losartan',
  norvasc: 'amlodipine',
  ventolin: 'salbutamol',
  neobloc: 'metoprolol',
  tenormin: 'atenolol',
  zestril: 'lisinopril',
  lipitor: 'atorvastatin',
  crestor: 'rosuvastatin',
  zocor: 'simvastatin',
  amoxil: 'amoxicillin',
  zithromax: 'azithromycin',
  ciprobay: 'ciprofloxacin',
  advil: 'ibuprofen',
  medicol: 'ibuprofen',
  dolfenal: 'mefenamic acid',
  ponstan: 'mefenamic acid',
  voltaren: 'diclofenac',
  cataflam: 'diclofenac',
  zyrtec: 'cetirizine',
  claritin: 'loratadine',
  losec: 'omeprazole',
  nexium: 'esomeprazole',
  lasix: 'furosemide',
  coumadin: 'warfarin',
  synthroid: 'levothyroxine',
  diamicron: 'gliclazide',
  amaryl: 'glimepiride',
  plavix: 'clopidogrel',
  aspilets: 'aspirin',
  cardiprin: 'aspirin',
};

const DOSE = /\b\d+(?:[.,]\d+)?\s*(?:mg|mcg|ug|g|kg|ml|l|iu|units?|%)(?:\s*\/\s*\d*(?:[.,]\d+)?\s*(?:mg|mcg|g|ml|l))?(?![a-z])/g;
const FORM_WORDS =
  /\b(?:tablets?|tabs?|capsules?|caps?|syrup|suspension|solution|drops?|injection|inhaler|cream|ointment|gel|sachets?|suppositor(?:y|ies)|xr|sr|er|mr|cr)\b/g;

export function toGeneric(name: string): string {
  const cleaned = name
    .toLowerCase()
    .replace(DOSE, ' ')
    .replace(FORM_WORDS, ' ')
    .replace(/\b\d+(?:[.,]\d+)?\b/g, ' ')
    .replace(/[(),]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return Object.prototype.hasOwnProperty.call(BRAND_TO_GENERIC, cleaned) ? BRAND_TO_GENERIC[cleaned] : cleaned;
}
