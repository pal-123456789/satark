// Run every knowledge-base signal's detectors against the text.
// A signal "fires" if any keyword (substring, case-insensitive) or any regex
// matches. We return the matched signals with everything the UI needs to
// explain *why* — label, reason, citation, suggested action. No scoring here;
// scoring.js owns combination so the two concerns stay testable in isolation.

function compileRegex(src) {
  try {
    return new RegExp(src, 'i');
  } catch {
    return null;
  }
}

export function evaluate(text, kb) {
  const raw = String(text || '');
  const lower = raw.toLowerCase();
  const matched = [];

  for (const s of kb.signals || []) {
    let hit = false;
    const d = s.detect || {};

    if (Array.isArray(d.keywords)) {
      for (const k of d.keywords) {
        if (k && lower.includes(String(k).toLowerCase())) { hit = true; break; }
      }
    }
    if (!hit && Array.isArray(d.regex)) {
      for (const r of d.regex) {
        const re = compileRegex(r);
        if (re && re.test(raw)) { hit = true; break; }
      }
    }
    if (hit) {
      matched.push({
        id: s.id,
        category: s.category,
        severity: s.severity,
        weight: s.weight,
        label: s.label,
        reason: s.reason,
        citation: s.citation || null,
        action: s.action || null
      });
    }
  }
  return matched;
}
