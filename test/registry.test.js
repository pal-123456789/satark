import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse } from '../src/engine/parse.js';
import { verdict } from '../src/engine/index.js';
import { checkRegistry } from '../src/engine/registry.js';
import { checkDomains } from '../src/engine/domains.js';

const kb = JSON.parse(readFileSync(new URL('../src/data/knowledge-base.json', import.meta.url)));
const registry = JSON.parse(readFileSync(new URL('../src/data/sebi-registry.json', import.meta.url)));
const domains = JSON.parse(readFileSync(new URL('../src/data/domains.json', import.meta.url)));

// ---- SEBI registry lookup --------------------------------------------------

test('unknown SEBI reg number → not-verified signal (high, not maxed — register is a reference)', () => {
  const r = checkRegistry(parse('I am SEBI registered, reg no INA000000000, invest with me.'), registry);
  const ids = r.signals.map((s) => s.id);
  assert.ok(ids.includes('sebi_reg_not_found'));
  const s = r.signals.find((x) => x.id === 'sebi_reg_not_found');
  assert.equal(s.severity, 'high');
  assert.ok(s.label.en && s.reason.en && s.action.en && s.citation.label, 'explainability contract');
  assert.equal(s.citation.url, null, 'honest-claims: no fabricated URL');
});

test('suspended/cancelled reg number → flagged signal (critical)', () => {
  const r = checkRegistry(parse('Trust me — SEBI reg INA000099001.'), registry);
  const ids = r.signals.map((s) => s.id);
  assert.ok(ids.includes('sebi_reg_flagged'));
  assert.equal(r.signals.find((x) => x.id === 'sebi_reg_flagged').severity, 'critical');
});

test('active reg number → no risk signal, only a reassurance note', () => {
  const r = checkRegistry(parse('My registration is INA000045210.'), registry);
  assert.equal(r.signals.length, 0);
  assert.equal(r.notes.length, 1);
  assert.equal(r.notes[0].type, 'verified_registry');
});

test('no reg number present → registry adds nothing', () => {
  const r = checkRegistry(parse('What is a mutual fund? I want to learn before investing.'), registry);
  assert.equal(r.signals.length, 0);
  assert.equal(r.notes.length, 0);
});

// ---- Domain / look-alike check --------------------------------------------

test('official regulator domain → reassurance note, no signal', () => {
  const r = checkDomains(parse('Details on https://www.sebi.gov.in/legal/circulars'), domains);
  assert.equal(r.signals.length, 0);
  assert.equal(r.notes.length, 1);
  assert.equal(r.notes[0].type, 'verified_domain');
});

test('known scam domain → critical signal', () => {
  const r = checkDomains(parse('Finish KYC at https://zerodha-kyc.online/login'), domains);
  assert.equal(r.signals[0].id, 'known_scam_domain');
});

test('homoglyph look-alike (zer0dha.com) → look-alike signal', () => {
  const r = checkDomains(parse('Open account at https://zer0dha.com now'), domains);
  assert.ok(r.signals.map((s) => s.id).includes('lookalike_domain'));
});

test('same brand on a different TLD (zerodha.xyz) → look-alike signal', () => {
  const r = checkDomains(parse('Login at https://zerodha.xyz'), domains);
  assert.ok(r.signals.map((s) => s.id).includes('lookalike_domain'));
});

test('one-letter typo (grow.in for groww.in) → look-alike via edit distance', () => {
  const r = checkDomains(parse('Visit https://grow.in to start'), domains);
  assert.ok(r.signals.map((s) => s.id).includes('lookalike_domain'));
});

test('trusted brand inside a deceptive host → brand-in-untrusted signal', () => {
  const r = checkDomains(parse('Verify now: https://sebi.gov.in.secure-verify.app/login'), domains);
  assert.ok(r.signals.map((s) => s.id).includes('brand_in_untrusted_domain'));
});

test('unknown link with suspicious TLD + phishy token → medium signal', () => {
  const r = checkDomains(parse('Claim your bonus: https://quick-kyc-verify.top'), domains);
  assert.ok(r.signals.map((s) => s.id).includes('suspicious_unverified_domain'));
});

test('ordinary unknown domain → no false alarm', () => {
  const r = checkDomains(parse('I read it on https://example.com/articles'), domains);
  assert.equal(r.signals.length, 0);
});

test('educational text with a plain SEBI mention but no number/link → no signals from either module', () => {
  const ent = parse('How do I check if a SEBI registered adviser is genuine?');
  assert.equal(checkRegistry(ent, registry).signals.length, 0);
  assert.equal(checkDomains(ent, domains).signals.length, 0);
});

// ---- End-to-end merge through the verdict engine ---------------------------

test('registry + domain pseudo-signals flow into the deterministic verdict', () => {
  const text = 'Adviser INA000000000 here, open your account at https://zerodha-kyc.online today!';
  const ent = parse(text);
  const extraSignals = [...checkRegistry(ent, registry).signals, ...checkDomains(ent, domains).signals];
  const v = verdict(text, kb, { extraSignals });
  const ids = v.reasons.map((r) => r.id);
  assert.ok(ids.includes('sebi_reg_not_found'));
  assert.ok(ids.includes('known_scam_domain'));
  assert.equal(v.bucket, 'high_risk');
  // determinism holds with extra signals merged in
  const again = verdict(text, kb, { extraSignals: [...checkRegistry(ent, registry).signals, ...checkDomains(ent, domains).signals] });
  assert.deepEqual(v, again);
});

test('bundled registry + domains data are well-formed', () => {
  assert.ok(Array.isArray(registry.intermediaries) && registry.intermediaries.length >= 8);
  for (const e of [...registry.intermediaries, ...registry.flagged]) {
    assert.ok(/^IN[HAZPBD][0-9]{9}$/i.test(e.regNo), `bad regNo: ${e.regNo}`);
  }
  const legit = Object.values(domains.legitimate).flat();
  assert.ok(legit.includes('sebi.gov.in') && legit.length >= 15);
  assert.ok(domains.detection.editDistanceThreshold >= 1);
});
