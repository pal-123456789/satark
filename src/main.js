// Satark app shell wiring. The engine runs 100% in the browser; nothing the
// user pastes is ever sent anywhere. (LLM explanation + voice land in later tasks.)
import { verdict } from './engine/index.js';
import { parse } from './engine/parse.js';
import { checkRegistry } from './engine/registry.js';
import { checkDomains } from './engine/domains.js';

const BUCKET = {
  safe:      { label: 'Looks safe',   sub: 'No strong fraud signals found. Stay alert anyway.', col: 'var(--safe)',    bg: 'var(--safe-bg)' },
  caution:   { label: 'Be careful',   sub: 'Some warning signs. Verify before you act.',          col: 'var(--caution)', bg: 'var(--caution-bg)' },
  high_risk: { label: 'High risk',    sub: 'Strong signs of a scam. Do not pay or share details.', col: 'var(--risk)',    bg: 'var(--risk-bg)' }
};
const SEV = { critical: '#b42318', high: '#d9480f', medium: '#9a6700', low: '#5b6472' };

const SAMPLE = 'SEBI registered advisor here! 📈 Guaranteed 300% returns in 30 days. Limited VIP seats — join our Telegram t.me/surestocktips and pay ₹5000 to activate your account today!';

let kb = null;
let registry = null;
let domains = null;
const $ = (id) => document.getElementById(id);

async function loadKB() {
  const grab = (p) => fetch(p, { cache: 'no-cache' }).then((r) => r.json());
  [kb, registry, domains] = await Promise.all([
    grab('src/data/knowledge-base.json'),
    grab('src/data/sebi-registry.json').catch(() => null),
    grab('src/data/domains.json').catch(() => null)
  ]);
}

function esc(s) { return String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])); }

function render(v, notes = []) {
  const b = BUCKET[v.bucket];
  const reasons = v.reasons.map((r) => `
    <li>
      <div class="rl"><span class="dot" style="background:${SEV[r.severity] || SEV.low}"></span>${esc(r.label.en)}</div>
      <div class="why">${esc(r.reason.en)}</div>
      ${r.citation && r.citation.label ? `<div class="cite">📎 ${esc(r.citation.label)}</div>` : ''}
      ${r.action && r.action.en ? `<div class="act">➡ ${esc(r.action.en)}</div>` : ''}
    </li>`).join('');

  const notesHtml = (notes || []).map((n) => `
    <li class="note">
      <div class="rl"><span class="dot" style="background:var(--safe)"></span>${esc((n.label && n.label.en) || '')}</div>
      ${n.detail && n.detail.en ? `<div class="why">${esc(n.detail.en)}</div>` : ''}
    </li>`).join('');

  const ent = [];
  if (v.entities.sebiRegNos.length) ent.push(`${v.entities.sebiRegNos.length} reg no`);
  if (v.entities.urls.length || v.entities.inviteLinks.length) ent.push(`${v.entities.urls.length + v.entities.inviteLinks.length} link(s)`);
  if (v.entities.upiHandles.length) ent.push('UPI id');
  if (v.entities.amounts.length) ent.push('money ask');
  if (v.entities.percents.length) ent.push('return promise');

  const el = $('result');
  el.style.display = 'block';
  el.innerHTML = `
    <div class="verdict">
      <div class="gauge" style="background:${b.bg};color:${b.col};border:3px solid ${b.col}">${v.score}</div>
      <div><div class="vlabel" style="color:${b.col}">${b.label}</div><div class="vsub">${b.sub}</div></div>
    </div>
    ${reasons ? `<ul class="reasons">${reasons}</ul>` : '<p class="vsub" style="margin-top:12px">We didn\'t spot known red flags — but if something feels off, don\'t rush.</p>'}
    ${notesHtml ? `<ul class="reasons notes-list">${notesHtml}</ul>` : ''}
    ${ent.length ? `<div class="chips"><span class="vsub">We spotted:</span>${ent.map((e) => `<b>${esc(e)}</b>`).join('')}</div>` : ''}
    <p class="disclaimer">Satark explains risk signals so you can decide for yourself. It is not investment advice and never tells you to buy, sell, or hold anything.</p>`;
  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function run() {
  const text = $('artifact').value.trim();
  if (!text) { $('artifact').focus(); return; }
  const ent = parse(text);
  const reg = registry ? checkRegistry(ent, registry) : { signals: [], notes: [] };
  const dom = domains ? checkDomains(ent, domains) : { signals: [], notes: [] };
  const extraSignals = [...reg.signals, ...dom.signals];
  render(verdict(text, kb, { extraSignals }), [...reg.notes, ...dom.notes]);
}

async function init() {
  await loadKB();
  $('check').addEventListener('click', run);
  $('sample').addEventListener('click', () => { $('artifact').value = SAMPLE; run(); });
  $('artifact').addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') run(); });
  if ('serviceWorker' in navigator) {
    try { await navigator.serviceWorker.register('sw.js'); } catch { /* offline reg optional */ }
  }
}
init();
