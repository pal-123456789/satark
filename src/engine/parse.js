// Entity extraction from a pasted/forwarded artifact. Pure, deterministic,
// offline. We surface the structured entities both to drive signal detectors
// and to show the user *what we saw* (transparency).

const PATTERNS = {
  // SEBI registration numbers: INH/INA/INZ/INP/INB/IND + 9 digits (e.g. INH000001234)
  sebiRegNo: /\bIN[HAZPBD][0-9]{9}\b/gi,
  url: /\bhttps?:\/\/[^\s<>"')]+/gi,
  // UPI VPA like name@okaxis, 9876543210@ybl — require a known-ish handle shape
  upi: /\b[a-z0-9][a-z0-9._-]{1,}@[a-z]{2,}\b/gi,
  phone: /(?:\+?91[\s-]?)?[6-9][0-9]{9}\b/g,
  money: /(?:₹|rs\.?|inr)\s?[0-9][0-9,]*(?:\.[0-9]+)?/gi,
  percent: /\b[0-9]{1,4}\s?%/g,
  telegramInvite: /\b(?:t\.me|telegram\.me|chat\.whatsapp\.com)\/[^\s]+/gi
};

function matchAll(text, re) {
  const out = [];
  const m = text.match(re);
  if (m) for (const x of m) out.push(x.trim());
  return [...new Set(out)];
}

export function parse(text) {
  const t = String(text || '');
  const upi = matchAll(t, PATTERNS.upi).filter((v) => !/\.(com|in|org|net|co)$/i.test(v)); // drop emails
  return {
    sebiRegNos: matchAll(t, PATTERNS.sebiRegNo).map((s) => s.toUpperCase()),
    urls: matchAll(t, PATTERNS.url),
    inviteLinks: matchAll(t, PATTERNS.telegramInvite),
    upiHandles: upi,
    phones: matchAll(t, PATTERNS.phone),
    amounts: matchAll(t, PATTERNS.money),
    percents: matchAll(t, PATTERNS.percent),
    length: t.length
  };
}
