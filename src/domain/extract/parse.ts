import type { CandidateRecord } from '../types';

export const LOW_CONFIDENCE = 70;

const months: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
const datePattern = /\b(\d{4}-\d{1,2}-\d{1,2}|\d{1,2}\/\d{1,2}\/\d{4}|\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4}|(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4})\b/i;

function isoDate(text: string): string | null {
  const match = text.match(datePattern)?.[0];
  if (!match) return null;
  let year: number, month: number, day: number;
  if (/^\d{4}-/.test(match)) [year, month, day] = match.split('-').map(Number);
  else if (match.includes('/')) [month, day, year] = match.split('/').map(Number);
  else {
    const parts = match.replace(',', '').split(/\s+/);
    if (/^\d/.test(parts[0])) { day = Number(parts[0]); month = months[parts[1].slice(0, 3).toLowerCase()]; year = Number(parts[2]); }
    else { month = months[parts[0].slice(0, 3).toLowerCase()]; day = Number(parts[1]); year = Number(parts[2]); }
  }
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}` : null;
}

function frequency(line: string): string | null {
  const match = line.match(/\b(?:once|twice|three times|four times)\s+daily(?:[\s-]+at bedtime)?\b|\b(?:OD|BID|TID|QID)\b|\bevery\s+\d+\s+hours?\b/i);
  return match ? match[0].replace(/-at bedtime/i, ' at bedtime').toLowerCase() : null;
}

export function parseDocumentText(text: string): CandidateRecord[] {
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  if (!lines.length) return [];
  const provider = lines.find(line => !/^(sample|prescription(?: form)?|discharge summary|official diagnostic report)$/i.test(line)) ?? null;
  const occurredOn = lines.map(isoDate).find(Boolean) ?? null;
  const base = { occurredOn, providerName: provider };
  const records: CandidateRecord[] = [];
  const labResults: { name: string; value: string; unit: string | null; referenceRange: string | null }[] = [];
  let labTitle: string | null = null;
  let visitReason: string | null = null;
  let followUpOn: string | null = null;
  let admission: string | null = null;
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const diagnosis = line.match(/^Diagnosis:\s*(.+)$/i);
    if (diagnosis) { records.push({ ...base, type: 'diagnosis', title: diagnosis[1], details: { kind: 'diagnosis' } }); continue; }
    const procedure = line.match(/^Procedure:\s*(.+)$/i);
    if (procedure) { visitReason = procedure[1]; records.push({ ...base, type: 'procedure', title: procedure[1], details: { kind: 'procedure' } }); continue; }
    const admissionMatch = line.match(/^Admission:\s*(Hospital admission)\b/i);
    if (admissionMatch) { admission = admissionMatch[1]; continue; }
    if (/^Follow-up visit:/i.test(line)) { followUpOn = isoDate(line); continue; }
    if (/^blood chemistry$/i.test(line)) { labTitle = 'Blood chemistry'; continue; }
    const lab = line.match(/^([A-Za-z][A-Za-z0-9 ]*?)\s+(\d+(?:\.\d+)?)\s+(%|mg\/dL|mmol\/L|g\/dL|IU\/L)(?:\s+((?:below[. ]\s*\d+)|\d+(?:\.\d+)?\s*[-–]\s*\d+(?:\.\d+)?))?$/i);
    if (lab && (labTitle || /\b(?:hba1c|blood|cholesterol|creatinine)\b/i.test(lab[1]))) {
      labResults.push({ name: lab[1], value: lab[2], unit: lab[3], referenceRange: lab[4]?.replace(/\s*[-–]\s*/, '-').replace(/^below[. ]\s*/i, 'below ') ?? null });
      continue;
    }
    const medication = line.match(/^(?:\d+\.\s*)?([A-Z][a-z][A-Za-z-]*)\s+(?:(\d+(?:\.\d+)?)\s*(mg|mcg|g|mL|IU)\b|tablet\b)(.*)$/i);
    if (medication && !/^(patient|date|department|clinical|official|attending|follow-up|blood|test|result|sex)$/i.test(medication[1])) {
      const next = lines[index + 1]?.match(/^Sig:\s*(.+)$/i)?.[1] ?? '';
      const dose = medication[2] ? `${medication[2]} ${medication[3]}` : null;
      records.push({ ...base, type: 'medication', title: medication[1], details: { kind: 'medication', genericName: null, dose, frequency: frequency(`${medication[4]} ${next}`), startOn: null, endOn: null } });
    }
  }
  if (labResults.length) records.push({ ...base, type: 'lab_result', title: labTitle ?? 'Lab result', details: { kind: 'lab_result', results: labResults } });
  if (admission) records.push({ ...base, type: 'visit', title: admission, details: { kind: 'visit', reason: visitReason, followUpOn } });
  return records;
}

export function needsHelp(read: { confidence: number }, candidates: CandidateRecord[]): boolean {
  return read.confidence < LOW_CONFIDENCE || candidates.length === 0;
}
