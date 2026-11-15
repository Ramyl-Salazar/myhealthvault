// The text-extraction prompt and the one call to the Gemini API.
// Rules: docs/rules/no-slop.md, "Clinical text" and "Prompts".

export const PROMPT = `You read one photographed page from a personal health record and list the records on it.

Rules:
- Copy text exactly as written on the page: spelling, capitals, numbers, units and abbreviations. Do not correct, expand, translate, round or explain anything.
- If a value is missing, cut off or hard to read, use null. Never guess.
- Add nothing that is not written on the page. Do not give advice or say what a value means.
- Write dates as YYYY-MM-DD only when the day, month and year are all clearly written. Otherwise use null.
- If you cannot read any record, return {"candidates": []}.

Answer with JSON only, no other text, in exactly this shape:
{"candidates": [Candidate, ...]}

Candidate:
{"type": Type, "title": string, "occurredOn": "YYYY-MM-DD" or null, "providerName": string or null, "details": Details}

Type is one of: "diagnosis", "allergy", "medication", "lab_result", "immunization", "procedure", "visit".
"title" is the name as written: the condition, the allergen, the medicine, the test panel, the vaccine, the procedure or the visit.

Details depends on type, and "kind" always equals "type":
- diagnosis: {"kind": "diagnosis"}
- procedure: {"kind": "procedure"}
- allergy: {"kind": "allergy", "reaction": string or null, "severity": "mild", "moderate", "severe" or null}
- medication: {"kind": "medication", "genericName": string or null, "dose": string or null, "frequency": string or null, "startOn": "YYYY-MM-DD" or null, "endOn": "YYYY-MM-DD" or null}
- lab_result: {"kind": "lab_result", "results": [{"name": string, "value": string, "unit": string or null, "referenceRange": string or null}]}
- immunization: {"kind": "immunization", "doseNumber": string or null}
- visit: {"kind": "visit", "reason": string or null, "followUpOn": "YYYY-MM-DD" or null}

Use "severity" only if the page uses one of those three words. Write lab values as strings, exactly as printed.`;

const API_ROOT = 'https://generativelanguage.googleapis.com/v1beta/models';

export type FetchFn = (url: string, init?: RequestInit) => Promise<Response>;

export interface GeminiInput {
  apiKey: string;
  model: string;
  image: Uint8Array;
  mimeType: string;
}

export function toBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(binary);
}

/** Sends the page to Gemini and returns its reply parsed as JSON. Throws on any failure. */
export async function requestGemini(fetchFn: FetchFn, input: GeminiInput): Promise<unknown> {
  const response = await fetchFn(`${API_ROOT}/${encodeURIComponent(input.model)}:generateContent`, {
    method: 'POST',
    // The key goes in a header so it never appears in a URL or a request log.
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': input.apiKey },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: PROMPT }, { inline_data: { mime_type: input.mimeType, data: toBase64(input.image) } }] }],
      generationConfig: { responseMimeType: 'application/json', temperature: 0 },
    }),
  });
  if (!response.ok) throw new Error(`Gemini answered ${response.status}`);
  const body = await response.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const reply = body.candidates?.[0]?.content?.parts?.map(part => part.text ?? '').join('') ?? '';
  if (!reply) throw new Error('Gemini returned no text');
  return JSON.parse(reply);
}
