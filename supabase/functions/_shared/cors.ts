// CORS and JSON responses for the public share functions. The clinician page may be
// opened from any origin and carries no cookies or session, so any origin is allowed
// and credentials never are. Contract: docs/contracts/share.md.

export const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '600',
};

/** A JSON answer. Share data is never cached by a browser or a proxy. */
export function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
  });
}

export function preflight(): Response {
  return new Response('ok', { headers: CORS_HEADERS });
}
