// SEBI intermediary registry check — a deterministic, offline lookup that turns
// a claimed registration number into an explainable pseudo-signal.
//
// Guardrail note: weights/severities are OWNED HERE (a safety/scoring decision,
// auditable in code), while the user-facing copy lives in the data file's
// `messages` block (so it can be translated for hi/gu without touching logic).
// The registry data is SYNTHETIC sample data; feasibility path is a live SEBI
// intermediary API with the same lookup shape.

const RULES = {
  not_found: { id: 'sebi_reg_not_found', category: 'impersonation', severity: 'high', weight: 65 },
  flagged: { id: 'sebi_reg_flagged', category: 'impersonation', severity: 'critical', weight: 88 }
};

function indexRegistry(reg) {
  const map = new Map();
  for (const e of reg.intermediaries || []) map.set(String(e.regNo).toUpperCase(), { ...e, _flagged: false });
  for (const e of reg.flagged || []) map.set(String(e.regNo).toUpperCase(), { ...e, _flagged: true });
  return map;
}

function signalFrom(rule, msg, extra) {
  return {
    id: rule.id,
    category: rule.category,
    severity: rule.severity,
    weight: rule.weight,
    label: msg.label,
    reason: msg.reason,
    action: msg.action,
    citation: msg.citation || { label: '', url: null },
    ...extra
  };
}

/**
 * @param {object} entities  output of parse() — uses entities.sebiRegNos
 * @param {object} reg        loaded sebi-registry.json
 * @returns {{signals: object[], notes: object[]}}
 */
export function checkRegistry(entities, reg) {
  const out = { signals: [], notes: [] };
  if (!reg || !entities || !Array.isArray(entities.sebiRegNos) || !entities.sebiRegNos.length) return out;

  const map = indexRegistry(reg);
  const seen = new Set();
  const M = reg.messages || {};

  for (const rawNo of entities.sebiRegNos) {
    const no = String(rawNo).toUpperCase();
    if (seen.has(no)) continue;
    seen.add(no);

    const hit = map.get(no);
    if (!hit) {
      out.signals.push(signalFrom(RULES.not_found, M.not_found || {}, { matchedOn: no }));
      continue;
    }
    const status = String(hit.status || '').toLowerCase();
    if (hit._flagged || status === 'suspended' || status === 'cancelled' || status === 'revoked' || status === 'debarred') {
      out.signals.push(signalFrom(RULES.flagged, M.flagged || {}, { matchedOn: no, status: hit.status }));
    } else {
      // Active match → reassurance only (never lowers the risk score).
      out.notes.push({
        type: 'verified_registry',
        matchedOn: no,
        name: hit.name,
        label: (M.verified && M.verified.label) || { en: 'Registration found' },
        detail: (M.verified && M.verified.detail) || { en: '' }
      });
    }
  }
  return out;
}
