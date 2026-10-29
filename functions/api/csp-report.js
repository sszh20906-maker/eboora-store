// POST /api/csp-report - receives browser Content-Security-Policy violation reports.
// Only the directive and the blocked host are logged (never query strings or personal data).
export async function onRequestPost({ request }) {
  const text = await request.text();
  if (text.length > 8192) return new Response(null, { status: 413 });
  try {
    const body = JSON.parse(text);
    const reports = Array.isArray(body) ? body : [body];
    for (const r of reports.slice(0, 5)) {
      const report = r["csp-report"] || r.body || {};
      const directive = String(report["effective-directive"] || report.effectiveDirective || "unknown").slice(0, 60);
      const blocked = String(report["blocked-url"] || report.blockedURL || "").split("?")[0].slice(0, 120);
      console.warn("CSP violation", directive, blocked);
    }
  } catch (_) { /* malformed reports are ignored */ }
  return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}
