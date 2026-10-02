// Domain / URL check — deterministic, offline anti-impersonation. Decides
// whether a link in the message is an official site, a look-alike of one, a
// trusted brand abused on an untrusted address, a known scam domain, or an
// unverified link with risky traits.
//
// Guardrail note: the legitimate-domain list is an anti-phishing reference, NOT
// an endorsement of any entity. Weights/severities are owned here; copy lives in
// the data file's `messages` block for translation.

const RULES = {
  known_scam: { id: 'known_scam_domain', category: 'technical', severity: 'critical', weight: 90 },
  lookalike: { id: 'lookalike_domain', category: 'technical', severity: 'critical', weight: 85 },
  brand_in_untrusted: { id: 'brand_in_untrusted_domain', category: 'technical', severity: 'high', weight: 70 },
  suspicious_unverified: { id: 'suspicious_unverified_domain', category: 'technical', severity: 'medium', weight: 38 }
};

function hostOf(url) {
  let h = String(url || '').trim().toLowerCase();
  h = h.replace(/^[a-z]+:\/\//, '').replace(/^www\./, '');
  h = h.split(/[/?#]/)[0].split(':')[0];
  return h;
}

// Registrable domain (eTLD+1) using a small bundled multi-part-suffix list.
function registrable(host, suffixes) {
  const labels = host.split('.').filter(Boolean);
  if (labels.length <= 2) return host;
  for (const suf of suffixes || []) {
    if (host === suf || host.endsWith('.' + suf)) {
      const take = suf.split('.').length + 1;
      return labels.slice(-take).join('.');
    }
  }
  return labels.slice(-2).join('.');
}

function sld(regDomain) {
  return regDomain.split('.')[0] || regDomain;
}

function homoglyphNormalize(s, map) {
  let out = String(s);
  for (const [from, to] of Object.entries(map || {})) out = out.split(from).join(to);
  return out;
}

function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  let cur = new Array(n + 1);
  for (let i = 1; i <= m; i++) {
    cur[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, cur] = [cur, prev];
  }
  return prev[n];
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
 * @param {object} entities  output of parse() — uses entities.urls
 * @param {object} dom        loaded domains.json
 * @returns {{signals: object[], notes: object[]}}
 */
export function checkDomains(entities, dom) {
  const out = { signals: [], notes: [] };
  if (!dom || !entities || !Array.isArray(entities.urls) || !entities.urls.length) return out;

  const det = dom.detection || {};
  const suffixes = det.multiPartSuffixes || [];
  const homo = det.homoglyphs || {};
  const thr = typeof det.editDistanceThreshold === 'number' ? det.editDistanceThreshold : 1;
  const legit = Object.values(dom.legitimate || {}).flat().map((d) => String(d).toLowerCase());
  const legitReg = legit.map((d) => registrable(d, suffixes));
  const legitSld = [...new Set(legitReg.map(sld))];
  const scam = new Set((dom.knownScamDomainsSample || []).map((d) => String(d).toLowerCase()));
  const M = dom.messages || {};

  const done = new Set();
  for (const url of entities.urls) {
    const host = hostOf(url);
    if (!host || done.has(host)) continue;
    done.add(host);

    const reg = registrable(host, suffixes);
    const hostSld = sld(reg);
    const normSld = homoglyphNormalize(hostSld, homo);
    const normHost = homoglyphNormalize(host, homo);

    // 1) exact known scam
    if (scam.has(host) || scam.has(reg)) {
      out.signals.push(signalFrom(RULES.known_scam, M.known_scam || {}, { matchedOn: host }));
      continue;
    }
    // 2) exact legitimate → reassurance note, no risk
    if (legit.includes(host) || legitReg.includes(reg)) {
      out.notes.push({ type: 'verified_domain', matchedOn: host, label: (M.verified && M.verified.label) || { en: 'Official website' }, detail: (M.verified && M.verified.detail) || { en: '' } });
      continue;
    }
    // 3) look-alike: same brand SLD (after homoglyph fix) OR within edit distance, but not the real domain
    const exactSld = legitSld.includes(hostSld) || legitSld.includes(normSld);
    const nearSld = legitSld.some((b) => b.length >= 4 && b !== hostSld && levenshtein(normSld, b) <= thr);
    if (exactSld || nearSld) {
      out.signals.push(signalFrom(RULES.lookalike, M.lookalike || {}, { matchedOn: host }));
      continue;
    }
    // 4) trusted brand name embedded anywhere in an untrusted host (incl. a deceptive subdomain)
    const brandToken = legitSld.find((b) => b.length >= 4 && new RegExp('(^|[^a-z])' + b + '([^a-z]|$)').test(normHost));
    if (brandToken) {
      out.signals.push(signalFrom(RULES.brand_in_untrusted, M.brand_in_untrusted || {}, { matchedOn: host, brand: brandToken }));
      continue;
    }
    // 5) unverified + risky traits: suspicious TLD AND a phishy token (both required → precision)
    const badTld = (det.suspiciousTlds || []).some((t) => host.endsWith(t));
    const phishy = (det.phishyTokens || []).some((tok) => host.includes(tok));
    if (badTld && phishy) {
      out.signals.push(signalFrom(RULES.suspicious_unverified, M.suspicious_unverified || {}, { matchedOn: host }));
    }
  }
  return out;
}
